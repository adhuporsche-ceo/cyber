const express = require('express');
const router = express.Router();
const {
  getStudents,
  getStudentById,
  createStudent,
  updateStudent,
  deleteStudent,
  restoreStudent,
  addSemester,
  updateSemester,
  deleteSemester,
  addArrear,
  updateArrear,
  deleteArrear,
  addIntervention,
  updateIntervention,
} = require('../controllers/postgresStudentController');
const { protect, can } = require('../middleware/authMiddleware');
const { importStudents, downloadTemplate } = require('../controllers/studentImportController');

// All student routes are protected
router.use(protect);

router.get('/import/template', can('student.import'), downloadTemplate);
router.post('/import', express.text({ type: ['text/csv', 'application/csv'] }), can('student.import'), importStudents);

// Student CRUD
router.route('/')
  .get(getStudents)
  .post(can('student.create'), createStudent);

router.get('/search', getStudents);

router.route('/:id')
  .get(getStudentById)
  .put(can('student.update'), updateStudent)
  .delete(can('student.delete'), deleteStudent);

router.put('/:id/restore', can('student.restore'), restoreStudent);

// Semesters
router.route('/:id/semesters')
  .post(can('student.update'), addSemester);

router.route('/:id/semesters/:semesterId')
  .put(can('student.update'), updateSemester)
  .delete(can('student.update'), deleteSemester);

// Arrears
router.route('/:id/arrears')
  .post(can('student.update'), addArrear);

router.route('/:id/arrears/:arrearId')
  .put(can('student.update'), updateArrear)
  .delete(can('student.update'), deleteArrear);

// Mentor Interventions
router.route('/:id/interventions')
  .post(can('student.mentor-action'), addIntervention);

router.route('/:id/interventions/:interventionId')
  .put(can('student.mentor-action'), updateIntervention);

module.exports = router;
