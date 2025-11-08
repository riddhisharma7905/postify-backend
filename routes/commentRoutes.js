import express from 'express';
import { addComment, getComments } from '../controllers/commentController.js';
import { authMiddleware } from "../middleware/authMiddleware.js"; 

const router = express.Router();

router.get('/:id/comments', getComments);
router.post('/:id/comments', authMiddleware, addComment);

export default router;