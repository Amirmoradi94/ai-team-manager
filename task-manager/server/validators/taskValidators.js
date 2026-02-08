const { body, param, query, validationResult } = require('express-validator');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map(err => ({ field: err.path, message: err.msg }))
    });
  }
  next();
};

// Validation rules for creating a task
const validateCreateTask = [
  body('title')
    .trim()
    .notEmpty().withMessage('Title is required')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must not exceed 2000 characters'),
  body('status')
    .optional()
    .isIn(['backlog', 'todo', 'in-progress', 'for-review', 'done']).withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('due_date')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  body('scheduled_date')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  body('scheduled_time')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (use HH:MM)'),
  body('assignee_id')
    .optional()
    .isString().withMessage('Invalid assignee ID'),
  handleValidationErrors
];

// Validation rules for updating a task
const validateUpdateTask = [
  param('id')
    .trim()
    .notEmpty().withMessage('Task ID is required'),
  body('title')
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 }).withMessage('Title must be 1-200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 2000 }).withMessage('Description must not exceed 2000 characters'),
  body('status')
    .optional()
    .isIn(['backlog', 'todo', 'in-progress', 'for-review', 'done']).withMessage('Invalid status'),
  body('priority')
    .optional()
    .isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('due_date')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  body('scheduled_date')
    .optional()
    .isISO8601().withMessage('Invalid date format'),
  body('scheduled_time')
    .optional()
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (use HH:MM)'),
  body('assignee_id')
    .optional()
    .isString().withMessage('Invalid assignee ID'),
  handleValidationErrors
];

// Validation for task ID parameter
const validateTaskId = [
  param('id')
    .trim()
    .notEmpty().withMessage('Task ID is required'),
  handleValidationErrors
];

// Validation for scheduled tasks query
const validateScheduledQuery = [
  query('start_date')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Invalid start date format'),
  query('end_date')
    .notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('Invalid end date format'),
  handleValidationErrors
];

module.exports = {
  validateCreateTask,
  validateUpdateTask,
  validateTaskId,
  validateScheduledQuery
};
