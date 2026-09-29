require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = Number(process.env.PORT || 3000);
const DB_FILE = path.join(__dirname, "database.db");

const uploadDirs = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "uploads", "videos"),
  path.join(__dirname, "uploads", "pdfs"),
  path.join(__dirname, "uploads", "homework")
];

for (const dir of uploadDirs) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const db = new Database(DB_FILE);

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student',
    grade TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    grade TEXT,
    price REAL DEFAULT 0,
    image TEXT,
    published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lessons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    pdf_url TEXT,
    homework TEXT,
    position INTEGER DEFAULT 0,
    published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS subscription_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    course_id INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    used_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id),
    FOREIGN KEY(used_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    end_date DATETIME NOT NULL,
    active INTEGER DEFAULT 1,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    UNIQUE(user_id, lesson_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(lesson_id) REFERENCES lessons(id)
);

CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    published INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(course_id) REFERENCES courses(id)
);

CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    points INTEGER DEFAULT 1,
    FOREIGN KEY(exam_id) REFERENCES exams(id)
);

CREATE TABLE IF NOT EXISTS exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(exam_id) REFERENCES exams(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS homework_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lesson_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    file_url TEXT,
    answer_text TEXT,
    score INTEGER,
    feedback TEXT,
    status TEXT DEFAULT 'pending',
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(lesson_id) REFERENCES lessons(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`);

function ensureAdmin() {
  const email = process.env.ADMIN_EMAIL || "admin@fareshany.com";
  const password = process.env.ADMIN_PASSWORD || "ChangeMe123!";

  const exists = db.prepare(
    "SELECT id FROM users WHERE email = ?"
  ).get(email);

  if (!exists) {
    const hash = bcrypt.hashSync(password, 12);

    db.prepare(`
      INSERT INTO users
      (name, email, password, role, phone)
      VALUES (?, ?, ?, 'admin', ?)
    `).run(
      "Mr Fares Hany",
      email,
      hash,
      process.env.WHATSAPP_NUMBER || "201096954340"
    );
  }
}

ensureAdmin();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "fares-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "public")));

const storage = multer.diskStorage({
  destination(req, file, cb) {
    let folder = "homework";

    if (file.mimetype.startsWith("video/")) {
      folder = "videos";
    }

    if (file.mimetype === "application/pdf") {
      folder = "pdfs";
    }

    cb(null, path.join(__dirname, "uploads", folder));
  },

  filename(req, file, cb) {
    const ext = path.extname(file.originalname);
    const name =
      Date.now() +
      "-" +
      crypto.randomBytes(6).toString("hex") +
      ext;

    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024 * 1024
  }
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({
      message: "يجب تسجيل الدخول أولًا"
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({
      message: "غير مسموح"
    });
  }

  next();
}

function generateCode() {
  return (
    "FH-" +
    crypto.randomBytes(3).toString("hex").toUpperCase() +
    "-" +
    crypto.randomBytes(3).toString("hex").toUpperCase()
  );
}

/* =========================
   AUTH
========================= */

app.post("/api/auth/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      password,
      grade
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "الاسم والإيميل والباسورد مطلوبة"
      });
    }

    const exists = db.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).get(email);

    if (exists) {
      return res.status(400).json({
        message: "الإيميل مستخدم بالفعل"
      });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = db.prepare(`
      INSERT INTO users
      (name, email, phone, password, grade, role)
      VALUES (?, ?, ?, ?, ?, 'student')
    `).run(
      name,
      email,
      phone || "",
      hash,
      grade || ""
    );

    req.session.user = {
      id: result.lastInsertRowid,
      name,
      email,
      role: "student"
    };

    res.json({
      success: true,
      user: req.session.user
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "حدث خطأ في التسجيل"
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare(
    "SELECT * FROM users WHERE email = ?"
  ).get(email);

  if (!user) {
    return res.status(401).json({
      message: "بيانات الدخول غير صحيحة"
    });
  }

  const valid = await bcrypt.compare(password, user.password);

  if (!valid) {
    return res.status(401).json({
      message: "بيانات الدخول غير صحيحة"
    });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    grade: user.grade
  };

  res.json({
    success: true,
    user: req.session.user
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({
      success: true
    });
  });
});

app.get("/api/auth/me", (req, res) => {
  res.json({
    user: req.session.user || null
  });
});

/* =========================
   COURSES
========================= */

app.get("/api/courses", (req, res) => {
  const courses = db.prepare(`
    SELECT *
    FROM courses
    WHERE published = 1
    ORDER BY id DESC
  `).all();

  res.json(courses);
});

app.post("/api/admin/courses", requireAdmin, (req, res) => {
  const {
    title,
    description,
    grade,
    price,
    image
  } = req.body;

  if (!title) {
    return res.status(400).json({
      message: "عنوان الكورس مطلوب"
    });
  }

  const result = db.prepare(`
    INSERT INTO courses
    (title, description, grade, price, image)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    title,
    description || "",
    grade || "",
    Number(price || 0),
    image || ""
  );

  res.json({
    success: true,
    id: result.lastInsertRowid
  });
});

app.delete("/api/admin/courses/:id", requireAdmin, (req, res) => {
  db.prepare(
    "DELETE FROM courses WHERE id = ?"
  ).run(req.params.id);

  res.json({
    success: true
  });
});

/* =========================
   LESSONS
========================= */

app.get("/api/courses/:courseId/lessons", requireLogin, (req, res) => {
  const lessons = db.prepare(`
    SELECT *
    FROM lessons
    WHERE course_id = ?
      AND published = 1
    ORDER BY position ASC, id ASC
  `).all(req.params.courseId);

  res.json(lessons);
});

app.post("/api/admin/lessons", requireAdmin, upload.fields([
  { name: "video", maxCount: 1 },
  { name: "pdf", maxCount: 1 }
]), (req, res) => {

  const video = req.files?.video?.[0];
  const pdf = req.files?.pdf?.[0];

  const videoUrl =
    video
      ? "/uploads/videos/" + video.filename
      : req.body.video_url || "";

  const pdfUrl =
    pdf
      ? "/uploads/pdfs/" + pdf.filename
      : req.body.pdf_url || "";

  const result = db.prepare(`
    INSERT INTO lessons
    (course_id, title, description, video_url, pdf_url, homework, position)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    Number(req.body.course_id),
    req.body.title,
    req.body.description || "",
    videoUrl,
    pdfUrl,
    req.body.homework || "",
    Number(req.body.position || 0)
  );

  res.json({
    success: true,
    lessonId: result.lastInsertRowid
  });
});

/* =========================
   SUBSCRIPTION CODES
========================= */

app.post("/api/admin/codes/generate", requireAdmin, (req, res) => {
  const courseId = Number(req.body.course_id);
  const duration = Number(req.body.duration_days || 30);
  const quantity = Math.min(
    Number(req.body.quantity || 1),
    500
  );

  const codes = [];

  for (let i = 0; i < quantity; i++) {
    let code = generateCode();

    while (
      db.prepare(
        "SELECT id FROM subscription_codes WHERE code = ?"
      ).get(code)
    ) {
      code = generateCode();
    }

    db.prepare(`
      INSERT INTO subscription_codes
      (code, course_id, duration_days)
      VALUES (?, ?, ?)
    `).run(
      code,
      courseId,
      duration
    );

    codes.push(code);
  }

  res.json({
    success: true,
    codes
  });
});

app.post("/api/student/activate-code", requireLogin, (req, res) => {
  const code = String(
    req.body.code || ""
  ).trim().toUpperCase();

  const row = db.prepare(`
    SELECT *
    FROM subscription_codes
    WHERE code = ?
      AND used = 0
  `).get(code);

  if (!row) {
    return res.status(400).json({
      message: "الكود غير صحيح أو مستخدم"
    });
  }

  const endDate = new Date();

  endDate.setDate(
    endDate.getDate() + row.duration_days
  );

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE subscription_codes
      SET used = 1, used_by = ?
      WHERE id = ?
    `).run(
      req.session.user.id,
      row.id
    );

    db.prepare(`
      INSERT INTO subscriptions
      (user_id, course_id, end_date)
      VALUES (?, ?, ?)
    `).run(
      req.session.user.id,
      row.course_id,
      endDate.toISOString()
    );
  });

  tx();

  res.json({
    success: true,
    courseId: row.course_id,
    endDate
  });
});

/* =========================
   STUDENT DASHBOARD
========================= */

app.get("/api/student/dashboard", requireLogin, (req, res) => {
  const studentId = req.session.user.id;

  const student = db.prepare(`
    SELECT
      id,
      name,
      email,
      phone,
      grade
    FROM users
    WHERE id = ?
  `).get(studentId);

  const subscriptions = db.prepare(`
    SELECT
      s.*,
      c.title AS course_title,
      c.description
    FROM subscriptions s
    JOIN courses c
      ON c.id = s.course_id
    WHERE s.user_id = ?
    ORDER BY s.id DESC
  `).all(studentId);

  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_lessons,
      SUM(
        CASE
          WHEN p.completed = 1 THEN 1
          ELSE 0
        END
      ) AS completed_lessons
    FROM lessons l
    LEFT JOIN progress p
      ON p.lesson_id = l.id
     AND p.user_id = ?
  `).get(studentId);

  res.json({
    student,
    subscriptions,
    stats
  });
});

/* =========================
   PROGRESS
========================= */

app.post("/api/student/progress", requireLogin, (req, res) => {
  const {
    lesson_id,
    progress: lessonProgress,
    completed
  } = req.body;

  db.prepare(`
    INSERT INTO progress
    (user_id, lesson_id, progress, completed)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, lesson_id)
    DO UPDATE SET
      progress = excluded.progress,
      completed = excluded.completed
  `).run(
    req.session.user.id,
    Number(lesson_id),
    Number(lessonProgress || 0),
    completed ? 1 : 0
  );

  res.json({
    success: true
  });
});

/* =========================
   EXAMS
========================= */

app.get("/api/exams/:courseId", requireLogin, (req, res) => {
  const exams = db.prepare(`
    SELECT *
    FROM exams
    WHERE course_id = ?
      AND published = 1
    ORDER BY id DESC
  `).all(req.params.courseId);

  res.json(exams);
});

app.get("/api/exams/:examId/questions", requireLogin, (req, res) => {
  const questions = db.prepare(`
    SELECT
      id,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      points
    FROM questions
    WHERE exam_id = ?
  `).all(req.params.examId);

  res.json(questions);
});

app.post("/api/admin/exams", requireAdmin, (req, res) => {
  const {
    course_id,
    title,
    duration_minutes
  } = req.body;

  const result = db.prepare(`
    INSERT INTO exams
    (course_id, title, duration_minutes)
    VALUES (?, ?, ?)
  `).run(
    course_id,
    title,
    duration_minutes || 30
  );

  res.json({
    success: true,
    examId: result.lastInsertRowid
  });
});

app.post("/api/admin/questions", requireAdmin, (req, res) => {
  const {
    exam_id,
    question,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_answer,
    points
  } = req.body;

  const result = db.prepare(`
    INSERT INTO questions
    (
      exam_id,
      question,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_answer,
      points
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    exam_id,
    question,
    option_a,
    option_b,
    option_c,
    option_d,
    correct_answer,
    points || 1
  );

  res.json({
    success: true,
    questionId: result.lastInsertRowid
  });
});

app.post("/api/student/exams/:examId/submit", requireLogin, (req, res) => {
  const examId = Number(req.params.examId);
  const answers = req.body.answers || {};

  const questions = db.prepare(`
    SELECT *
    FROM questions
    WHERE exam_id = ?
  `).all(examId);

  let score = 0;
  let total = 0;

  for (const q of questions) {
    total += Number(q.points || 1);

    if (
      String(answers[q.id] || "").toUpperCase() ===
      String(q.correct_answer || "").toUpperCase()
    ) {
      score += Number(q.points || 1);
    }
  }

  db.prepare(`
    INSERT INTO exam_attempts
    (exam_id, user_id, score, total)
    VALUES (?, ?, ?, ?)
  `).run(
    examId,
    req.session.user.id,
    score,
    total
  );

  res.json({
    success: true,
    score,
    total,
    percentage:
      total === 0
        ? 0
        : Math.round((score / total) * 100)
  });
});

/* =========================
   HOMEWORK
========================= */

app.post(
  "/api/student/homework/:lessonId",
  requireLogin,
  upload.single("file"),
  (req, res) => {

    const fileUrl = req.file
      ? "/uploads/homework/" + req.file.filename
      : "";

    db.prepare(`
      INSERT INTO homework_submissions
      (lesson_id, user_id, file_url, answer_text)
      VALUES (?, ?, ?, ?)
    `).run(
      req.params.lessonId,
      req.session.user.id,
      fileUrl,
      req.body.answer_text || ""
    );

    res.json({
      success: true
    });
  }
);

/* =========================
   ADMIN STUDENTS
========================= */

app.get("/api/admin/students", requireAdmin, (req, res) => {
  const students = db.prepare(`
    SELECT
      id,
      name,
      email,
      phone,
      grade,
      created_at
    FROM users
    WHERE role = 'student'
    ORDER BY id DESC
  `).all();

  res.json(students);
});

/* =========================
   ADMIN HOMEWORK
========================= */

app.get("/api/admin/homework", requireAdmin, (req, res) => {
  const submissions = db.prepare(`
    SELECT
      h.*,
      u.name AS student_name,
      l.title AS lesson_title
    FROM homework_submissions h
    JOIN users u
      ON u.id = h.user_id
    JOIN lessons l
      ON l.id = h.lesson_id
    ORDER BY h.id DESC
  `).all();

  res.json(submissions);
});

app.post(
  "/api/admin/homework/:id/grade",
  requireAdmin,
  (req, res) => {

    db.prepare(`
      UPDATE homework_submissions
      SET
        score = ?,
        feedback = ?,
        status = 'graded'
      WHERE id = ?
    `).run(
      Number(req.body.score),
      req.body.feedback || "",
      req.params.id
    );

    res.json({
      success: true
    });
  }
);

/* =========================
   ANNOUNCEMENTS
========================= */

app.get("/api/announcements", requireLogin, (req, res) => {
  const announcements = db.prepare(`
    SELECT *
    FROM announcements
    ORDER BY id DESC
    LIMIT 50
  `).all();

  res.json(announcements);
});

app.post("/api/admin/announcements", requireAdmin, (req, res) => {
  db.prepare(`
    INSERT INTO announcements
    (title, body)
    VALUES (?, ?)
  `).run(
    req.body.title,
    req.body.body
  );

  res.json({
    success: true
  });
});

/* =========================
   WHATSAPP
========================= */

app.get("/api/settings", (req, res) => {
  res.json({
    teacherName: "Mr Fares Hany",
    whatsapp:
      process.env.WHATSAPP_NUMBER ||
      "201096954340"
  });
});

/* =========================
   PAGES
========================= */

app.get("/", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

app.get("/student", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "student.html")
  );
});

app.get("/admin", (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "admin.html")
  );
});

app.use((req, res) => {
  res.status(404).json({
    message: "Not found"
  });
});

app.listen(PORT, () => {
  console.log(`
====================================
 Mr Fares Hany Platform
====================================

Server:
http://localhost:${PORT}

Student:
http://localhost:${PORT}/student

Admin:
http://localhost:${PORT}/admin

WhatsApp:
https://wa.me/${process.env.WHATSAPP_NUMBER || "201096954340"}
`);
});