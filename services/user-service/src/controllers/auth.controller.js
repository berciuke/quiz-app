const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const createResponse = (
  success,
  data = null,
  error = null,
  pagination = null
) => ({
  success,
  ...(data && { data }),
  ...(error && { error }),
  ...(pagination && { pagination }),
});

const register = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role = "student" } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json(
        createResponse(false, null, {
          message: "Użytkownik z tym adresem email już istnieje",
        })
      );
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        username: `${user.firstName} ${user.lastName}`,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    console.log("[register] Creating token with userId:", user.id); // Debug log

    res.status(201).json(createResponse(true, { user, token }));
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json(
        createResponse(false, null, {
          message: "Nieprawidłowe dane logowania",
        })
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json(
        createResponse(false, null, {
          message: "Nieprawidłowe dane logowania",
        })
      );
    }

    if (!user.isActive) {
      return res.status(403).json(
        createResponse(false, null, {
          message: "Konto zostało dezaktywowane",
        })
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Wygeneruj token JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
        username: `${user.firstName} ${user.lastName}`,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    const { password: _, ...userWithoutPassword } = user;

    res
      .status(200)
      .json(createResponse(true, { user: userWithoutPassword, token }));
  } catch (error) {
    next(error);
  }
};

// Sprawdzenie tokenu
const verifyToken = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json(
        createResponse(false, null, {
          message: "Token nie został zweryfikowany",
        })
      );
    }

    const userIdFromToken = req.user.userId || req.user.id;

    if (!userIdFromToken) {
      return res.status(401).json(
        createResponse(false, null, {
          message: "Brak identyfikatora użytkownika w tokenie",
        })
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userIdFromToken },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json(
        createResponse(false, null, {
          message: "Użytkownik nie istnieje lub jest nieaktywny",
        })
      );
    }

    res.status(200).json(createResponse(true, { user, valid: true }));
  } catch (error) {
    next(error);
  }
};

// Reset hasła - krok 1: żądanie
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    console.log("Forgot password request for email:", email);

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(200).json(
        createResponse(true, {
          message:
            "Jeśli adres email istnieje, został wysłany link do resetowania hasła",
        })
      );
    }

    const resetToken = jwt.sign(
      { userId: user.id, type: "password-reset" },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(200).json(
      createResponse(true, {
        message: "Link do resetowania hasła został wysłany",
        resetToken: resetToken,
      })
    );
  } catch (error) {
    next(error);
  }
};

// Reset hasła - krok 2: nowe hasło
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json(
        createResponse(false, null, {
          message: "Token i nowe hasło są wymagane",
        })
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return res.status(400).json(
        createResponse(false, null, {
          message: "Token jest nieprawidłowy lub wygasł",
        })
      );
    }

    if (decoded.type !== "password-reset") {
      return res
        .status(400)
        .json(
          createResponse(false, null, { message: "Token ma nieprawidłowy typ" })
        );
    }

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    await prisma.user.update({
      where: { id: decoded.userId },
      data: { password: hashedPassword },
    });

    res
      .status(200)
      .json(
        createResponse(true, { message: "Hasło zostało pomyślnie zresetowane" })
      );
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  verifyToken,
  forgotPassword,
  resetPassword,
};
