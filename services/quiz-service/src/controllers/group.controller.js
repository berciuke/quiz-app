const Group = require("../models/Group");

exports.createGroup = async (req, res) => {
  try {
    const { name, description, members, isPublic } = req.body;
    const creatorId = req.user.id;

    const group = await Group.create({
      name,
      description,
      isPublic: isPublic || false,
      createdBy: creatorId,
      members: [
        { userId: creatorId, role: "admin" },
        ...(members?.map((userId) => ({ userId, role: "member" })) || []),
      ],
    });

    res.status(201).json({
      message: "Group created successfully",
      group,
    });
  } catch (error) {
    console.error("[createGroup] Error:", error);
    res.status(500).json({
      error: "Failed to create group",
      details: error.message,
    });
  }
};

exports.getAllGroups = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    let filter = {};

    if (search) {
      filter = {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const groups = await Group.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("name description isPublic createdBy createdAt members")
      .exec();

    const total = await Group.countDocuments(filter);

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      groups,
    });
  } catch (error) {
    console.error("[getAllGroups] Error:", error);
    res.status(500).json({
      error: "Failed to fetch groups",
      details: error.message,
    });
  }
};

exports.getGroupById = async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Prosty dostęp - każdy zalogowany użytkownik może zobaczyć grupę
    res.json(group);
  } catch (error) {
    console.error("[getGroupById] Error:", error);
    res.status(500).json({
      error: "Failed to fetch group",
      details: error.message,
    });
  }
};

exports.addMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { userId } = req.body;
    const requesterId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isAdmin = group.members.some(
      (m) => m.userId === requesterId && m.role === "admin"
    );
    if (!isAdmin) {
      return res
        .status(403)
        .json({ error: "Only group admins can add members" });
    }

    if (group.members.some((m) => m.userId === userId)) {
      return res
        .status(400)
        .json({ error: "User is already a member of this group" });
    }

    group.members.push({ userId, role: "member" });
    await group.save();

    res.json({
      message: "Member added successfully",
      group,
    });
  } catch (error) {
    console.error("[addMember] Error:", error);
    res.status(500).json({
      error: "Failed to add member",
      details: error.message,
    });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const groupId = req.params.id;
    const userIdToRemove = req.params.userId;
    const requesterId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isAdmin = group.members.some(
      (m) => m.userId === requesterId && m.role === "admin"
    );
    const isSelf = requesterId === userIdToRemove;

    if (!isAdmin && !isSelf) {
      return res
        .status(403)
        .json({
          error: "You can only remove yourself or admin can remove members",
        });
    }

    // Nie pozwól usunąć ostatniego admina
    const admins = group.members.filter((m) => m.role === "admin");
    const memberToRemove = group.members.find(
      (m) => m.userId === userIdToRemove
    );

    if (memberToRemove?.role === "admin" && admins.length === 1) {
      return res
        .status(400)
        .json({ error: "Cannot remove the last admin of the group" });
    }

    group.members = group.members.filter((m) => m.userId !== userIdToRemove);
    await group.save();

    res.json({
      message: "Member removed successfully",
      group,
    });
  } catch (error) {
    console.error("[removeMember] Error:", error);
    res.status(500).json({
      error: "Failed to remove member",
      details: error.message,
    });
  }
};

exports.getUserGroups = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const groups = await Group.find({ "members.userId": userId })
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select("name description isPublic createdBy createdAt members")
      .exec();

    const total = await Group.countDocuments({ "members.userId": userId });

    res.json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      groups,
    });
  } catch (error) {
    console.error("[getUserGroups] Error:", error);
    res.status(500).json({
      error: "Failed to fetch user groups",
      details: error.message,
    });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const { name, description, isPublic } = req.body;
    const requesterId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isAdmin = group.members.some(
      (m) => m.userId === requesterId && m.role === "admin"
    );
    if (!isAdmin) {
      return res
        .status(403)
        .json({ error: "Only group admins can update group" });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.isPublic = isPublic;

    const updatedGroup = await Group.findByIdAndUpdate(groupId, updateData, {
      new: true,
      runValidators: true,
    });

    res.json({
      message: "Group updated successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.error("[updateGroup] Error:", error);
    res.status(500).json({
      error: "Failed to update group",
      details: error.message,
    });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const groupId = req.params.id;
    const requesterId = req.user.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isAdmin = group.members.some(
      (m) => m.userId === requesterId && m.role === "admin"
    );
    if (!isAdmin) {
      return res
        .status(403)
        .json({ error: "Only group admins can delete group" });
    }

    await Group.findByIdAndDelete(groupId);

    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("[deleteGroup] Error:", error);
    res.status(500).json({
      error: "Failed to delete group",
      details: error.message,
    });
  }
};

exports.joinGroup = async (req, res) => {
  try {
    const { groupId, inviteCode } = req.body;
    const userId = req.user.id;

    let group;
    
    if (groupId) {
      group = await Group.findById(groupId);
    } else if (inviteCode) {
      group = await Group.findOne({ inviteCode });
    } else {
      return res.status(400).json({ 
        error: "Either groupId or inviteCode is required" 
      });
    }

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is already a member
    if (group.members.some((m) => m.userId === userId)) {
      return res.status(400).json({ 
        error: "You are already a member of this group" 
      });
    }

    // For private groups, require invite code or admin approval
    if (!group.isPublic && !inviteCode) {
      return res.status(403).json({ 
        error: "This is a private group. Invite code required." 
      });
    }

    // Add user as member
    group.members.push({ userId, role: "member" });
    await group.save();

    res.json({
      message: "Successfully joined the group",
      group: {
        _id: group._id,
        name: group.name,
        description: group.description,
        isPublic: group.isPublic,
        memberCount: group.members.length
      }
    });
  } catch (error) {
    console.error("[joinGroup] Error:", error);
    res.status(500).json({
      error: "Failed to join group",
      details: error.message,
    });
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.body;
    const userId = req.user.id;

    if (!groupId) {
      return res.status(400).json({ 
        error: "Group ID is required" 
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is a member of the group
    const memberIndex = group.members.findIndex((m) => m.userId === userId);
    if (memberIndex === -1) {
      return res.status(400).json({ 
        error: "You are not a member of this group" 
      });
    }

    const member = group.members[memberIndex];

    // Check if user is the last admin
    const admins = group.members.filter((m) => m.role === "admin");
    if (member.role === "admin" && admins.length === 1) {
      return res.status(400).json({ 
        error: "Cannot leave group as the last admin. Transfer admin rights to another member first." 
      });
    }

    // Remove user from the group
    group.members.splice(memberIndex, 1);
    await group.save();

    res.json({
      message: "Successfully left the group",
      group: {
        _id: group._id,
        name: group.name,
        memberCount: group.members.length
      }
    });
  } catch (error) {
    console.error("[leaveGroup] Error:", error);
    res.status(500).json({
      error: "Failed to leave group",
      details: error.message,
    });
  }
};
