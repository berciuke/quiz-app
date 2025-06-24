const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const auth = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validation.middleware');
const { groupValidation, addMemberValidation, updateGroupValidation } = require('../validation/group.validation');

// CRUD operacje na grupach
router.post('/', auth, groupValidation, validateRequest, groupController.createGroup);
router.get('/', auth, groupController.getAllGroups);
router.get('/my', auth, groupController.getUserGroups);
router.get('/:id', auth, groupController.getGroupById);
router.put('/:id', auth, updateGroupValidation, validateRequest, groupController.updateGroup);
router.delete('/:id', auth, groupController.deleteGroup);

// Zarządzanie członkami grupy
router.post('/:id/members', auth, addMemberValidation, validateRequest, groupController.addMember);
router.delete('/:id/members/:userId', auth, groupController.removeMember);

module.exports = router; 