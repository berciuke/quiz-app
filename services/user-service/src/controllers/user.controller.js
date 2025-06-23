const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { prisma } = require('../config/db');

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Użytkownik z tym emailem już istnieje' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: role || 'student'
      }
    });

    const { password: _, ...userWithoutPassword } = user;

    res.status(201).json({
      message: 'Użytkownik został zarejestrowany pomyślnie',
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('[register]', error);
    
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Użytkownik z tym emailem już istnieje' });
    }
    
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Nieprawidłowy email lub hasło' });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '24h' }
    );

    res.json({ 
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role
      }
    });
  } catch (error) {
    console.error('[login]', error);
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        totalScore: true,
        averageScore: true,
        totalQuizzesPlayed: true,
        createdAt: true,
        lastLoginAt: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }

    res.json(user);
  } catch (error) {
    console.error('[getProfile]', error);
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    
    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: { firstName, lastName },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        emailVerified: true,
        totalScore: true,
        averageScore: true,
        totalQuizzesPlayed: true,
        updatedAt: true
      }
    });

    res.json({
      message: 'Profil został zaktualizowany pomyślnie',
      user: updatedUser
    });
  } catch (error) {
    console.error('[updateProfile]', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }
    
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await prisma.user.findUnique({ 
      where: { id: req.user.id }
    });

    if (!user) {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({ error: 'Obecne hasło jest nieprawidłowe' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedNewPassword }
    });

    res.json({ message: 'Hasło zostało zmienione pomyślnie' });
  } catch (error) {
    console.error('[changePassword]', error);
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, role, search } = req.query;
    const skip = (page - 1) * limit;

    const where = {};
    if (role && role !== 'all') {
      where.role = role;
    }
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          totalQuizzesPlayed: true,
          averageScore: true,
          createdAt: true,
          lastLoginAt: true
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[getAllUsers]', error);
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    const validRoles = ['student', 'instructor', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Nieprawidłowa rola' });
    }

    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Nie możesz zmienić własnej roli' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true
      }
    });

    res.json({
      message: 'Rola użytkownika została zaktualizowana',
      user: updatedUser
    });
  } catch (error) {
    console.error('[updateUserRole]', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }
    
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
};

exports.deactivateUser = async (req, res) => {
  try {
    const { userId } = req.params;

    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Nie możesz dezaktywować własnego konta' });
    }

    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: { isActive: false }
    });

    res.json({ message: 'Użytkownik został dezaktywowany' });
  } catch (error) {
    console.error('[deactivateUser]', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Użytkownik nie został znaleziony' });
    }
    
    res.status(500).json({ error: 'Błąd serwera', details: error.message });
  }
}; 