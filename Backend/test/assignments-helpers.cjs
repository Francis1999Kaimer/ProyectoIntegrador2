// Doble en memoria de las tablas que usa AssignmentsService (no es un archivo *.test.cjs).
const { randomUUID } = require('node:crypto')

function assignmentsDb({ rooms = [], enrollments = new Set(), users = [], projects = [], runs = [], coTeachers = new Set() } = {}) {
  const assignments = [], submissions = []
  const room = id => rooms.find(r => r.id === id)
  const roomMatches = (r, where) => !!r && Object.entries(where).every(([key, value]) =>
    key === 'OR' ? value.some(part => roomMatches(r, part))
    : key === 'back_fk_classroom_teachers_classroom' ? coTeachers.has(r.id + ':' + value.some.teacher_id)
    : key === 'back_fk_enrollments_classroom' ? enrollments.has(r.id + ':' + value.some.student_id) : r[key] === value)
  function matches(row, where = {}, kind) {
    return Object.entries(where).every(([key, value]) => {
      if (key === 'OR') return value.some(part => matches(row, part, kind))
      if (key === 'back_fk_submissions_assignment') return !submissions.some(s => s.assignment_id === row.id && s.student_id === value.none.student_id)
      if (key === 'rel_fk_assignments_classroom') return roomMatches(room(row.classroom_id), value)
      if (key === 'rel_fk_submissions_assignment') return roomMatches(room(assignments.find(a => a.id === row.assignment_id)?.classroom_id), value.rel_fk_assignments_classroom)
      if (value && typeof value === 'object' && !(value instanceof Date)) {
        if ('in' in value) return value.in.includes(row[key])
        if ('not' in value) return row[key] !== value.not
        if ('lte' in value) return row[key] <= value.lte
        if ('gte' in value) return row[key] >= value.gte
      }
      return value === null ? row[key] === null || row[key] === undefined : row[key] === value
    })
  }
  const pick = (row, select) => select ? Object.fromEntries(Object.keys(select).map(k => [k, row[k]])) : { ...row }
  const withRoom = (row, include) => include?.rel_fk_assignments_classroom ? { ...row, rel_fk_assignments_classroom: { name: room(row.classroom_id).name } } : { ...row }
  const byEnd = (a, b) => a.ends_at - b.ends_at || (a.id < b.id ? -1 : 1)
  const now = () => new Date()
  const db = {
    assignments: {
      findMany: async ({ where, include, take } = {}) => assignments.filter(a => matches(a, where)).sort(byEnd).slice(0, take ?? 1000).map(a => withRoom(a, include)),
      findUnique: async ({ where }) => assignments.find(a => a.id === where.id) ?? null,
      create: async ({ data }) => { const row = { created_at: now(), updated_at: now(), ...data }; assignments.push(row); return { ...row } },
      update: async ({ where, data }) => { const row = assignments.find(a => a.id === where.id); Object.assign(row, data); return { ...row } },
      delete: async ({ where }) => { const i = assignments.findIndex(a => a.id === where.id); assignments.splice(i, 1) }
    },
    assignment_submissions: {
      findMany: async ({ where, select } = {}) => submissions.filter(s => matches(s, where)).map(s => pick(s, select)),
      findUnique: async ({ where }) => { const k = where.assignment_id_student_id; return submissions.find(s => s.assignment_id === k.assignment_id && s.student_id === k.student_id) ?? null },
      count: async ({ where }) => submissions.filter(s => matches(s, where)).length,
      create: async ({ data }) => {
        if (submissions.some(s => s.assignment_id === data.assignment_id && s.student_id === data.student_id)) throw Object.assign(new Error('dup'), { code: 'P2002' })
        const row = { grade: null, feedback: null, graded_at: null, graded_by: null, ...data }; submissions.push(row); return { ...row }
      },
      update: async ({ where, data }) => { const row = submissions.find(s => s.id === where.id); Object.assign(row, data); return { ...row } }
    },
    projects: {
      findMany: async ({ where, select } = {}) => projects.filter(p => matches(p, where)).map(p => pick(p, select)),
      findUnique: async ({ where, select }) => { const p = projects.find(p => p.id === where.id); return p ? pick(p, select) : null }
    },
    training_runs: {
      findMany: async ({ where, select }) => runs.filter(r => matches(r, where)).map(r => pick(r, select)),
      findFirst: async ({ where }) => runs.filter(r => r.project_id === where.project_id).sort((a, b) => b.run_number - a.run_number)[0] ?? null
    },
    users: { findMany: async ({ where, select }) => users.filter(u => matches(u, where)).map(u => pick(u, select)) }
  }
  return { db, assignments, submissions }
}

/** Repositorio mínimo para LearningService.classroom y classroomStudents. */
function learningRepo({ rooms, enrollments, users, coTeachers = new Set() }) {
  return {
    classroom: async id => rooms.find(r => r.id === id) ?? null,
    teachesClassroom: async (id, teacher) => coTeachers.has(id + ':' + teacher) || rooms.some(r => r.id === id && r.teacher_id === teacher),
    enrolled: async (id, student) => enrollments.has(id + ':' + student),
    classroomStudents: async id => users.filter(u => u.role === 'student' && enrollments.has(id + ':' + u.id)).map(({ id, username, display_name, status }) => ({ id, username, display_name, status }))
  }
}

const day = 24 * 3600 * 1000
const iso = offsetDays => new Date(Date.now() + offsetDays * day).toISOString()
const person = (role, name) => ({ id: randomUUID(), role, username: name, display_name: name, status: 'active' })

module.exports = { assignmentsDb, learningRepo, iso, person }
