const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const { requireAuth } = require('../middleware/auth.middleware');
const { validateRequest } = require('../middleware/validation.middleware');
const { groupValidation, addMemberValidation, updateGroupValidation, joinGroupValidation, leaveGroupValidation } = require('../validation/group.validation');

// Middleware autoryzacji dla wszystkich tras
router.use(requireAuth);

// CRUD operacje na grupach
router.post('/', groupValidation, validateRequest, groupController.createGroup);
router.get('/', groupController.getAllGroups);
router.get('/my', groupController.getUserGroups);
router.get('/:id', groupController.getGroupById);
router.put('/:id', updateGroupValidation, validateRequest, groupController.updateGroup);
router.delete('/:id', groupController.deleteGroup);

// Zarządzanie członkami grupy
router.post('/:id/members', addMemberValidation, validateRequest, groupController.addMember);
router.delete('/:id/members/:userId', groupController.removeMember);

// Dołączanie do grup
router.post('/join', joinGroupValidation, validateRequest, groupController.joinGroup);

// Opuszczanie grup
router.post('/leave', leaveGroupValidation, validateRequest, groupController.leaveGroup);

module.exports = router; 