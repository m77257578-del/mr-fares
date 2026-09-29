async function loadCourses() {

  const response = await fetch("/api/courses");

  const courses = await response.json();

  const container =
    document.getElementById("coursesList");

  container.innerHTML = "";

  courses.forEach(course => {

    const card = document.createElement("div");

    card.className = "card course-card";

    card.innerHTML = `
      <div class="course-image">
        ${
          course.image
            ? `<img src="${course.image}">`
            : "FH"
        }
      </div>

      <h3>${escapeHtml(course.title)}</h3>

      <p>
        ${escapeHtml(course.description || "")}
      </p>

      <strong>
        ${course.price} جنيه
      </strong>

      <br><br>

      <a
        href="/student"
        class="btn primary"
      >
        اشترك الآن
      </a>
    `;

    container.appendChild(card);

  });

}

async function translateText() {

  const text =
    document
      .getElementById("sourceText")
      .value
      .trim();

  if (!text) {
    return;
  }

  const dictionaries = {

    "مدرسة": "school",
    "كتاب": "book",
    "امتحان": "exam",
    "طالب": "student",
    "مدرس": "teacher",
    "درس": "lesson",
    "مذاكرة": "study",
    "نجاح": "success",
    "واجب": "homework",
    "لغة": "language",
    "إنجليزي": "English",
    "شكرا": "thank you",
    "مرحبا": "hello",

    "school": "مدرسة",
    "book": "كتاب",
    "exam": "امتحان",
    "student": "طالب",
    "teacher": "مدرس",
    "lesson": "درس",
    "study": "مذاكرة",
    "success": "نجاح",
    "homework": "واجب",
    "language": "لغة",
    "english": "اللغة الإنجليزية",
    "thank you": "شكرا",
    "hello": "مرحبا"

  };

  const result =
    dictionaries[text.toLowerCase()] ||
    text
      .split(/\s+/)
      .map(word =>
        dictionaries[word.toLowerCase()] || word
      )
      .join(" ");

  document
    .getElementById("translationResult")
    .textContent = result;
}

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

loadCourses();