let dashboardData = null;

async function getMe() {

  const response =
    await fetch("/api/auth/me");

  const data =
    await response.json();

  if (!data.user) {

    window.location.href = "/";

    return null;
  }

  return data.user;
}

async function loadDashboard() {

  const user = await getMe();

  if (!user) {
    return;
  }

  const response =
    await fetch("/api/student/dashboard");

  dashboardData =
    await response.json();

  document
    .getElementById("studentName")
    .textContent =
    dashboardData.student.name;

  document
    .getElementById("totalLessons")
    .textContent =
    dashboardData.stats.total_lessons || 0;

  document
    .getElementById("completedLessons")
    .textContent =
    dashboardData.stats.completed_lessons || 0;

  document
    .getElementById("coursesCount")
    .textContent =
    dashboardData.subscriptions.length;

  renderSubscriptions();

  loadAnnouncements();

}

function renderSubscriptions() {

  const container =
    document.getElementById("subscriptionsList");

  container.innerHTML = "";

  dashboardData.subscriptions.forEach(sub => {

    const card =
      document.createElement("div");

    card.className = "card";

    card.innerHTML = `
      <h3>${escapeHtml(sub.course_title)}</h3>

      <p>
        ${escapeHtml(sub.description || "")}
      </p>

      <p>
        من:
        ${new Date(sub.start_date).toLocaleDateString()}
      </p>

      <p>
        حتى:
        ${new Date(sub.end_date).toLocaleDateString()}
      </p>

      <button
        class="btn primary"
        onclick="openCourse(${sub.course_id})"
      >
        فتح الكورس
      </button>
    `;

    container.appendChild(card);

  });

}

async function openCourse(courseId) {

  const response =
    await fetch(
      `/api/courses/${courseId}/lessons`
    );

  const lessons =
    await response.json();

  const modal =
    document.createElement("div");

  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-box">

      <button
        class="close"
        onclick="this.closest('.modal').remove()"
      >
        ×
      </button>

      <h2>دروس الكورس</h2>

      <div id="lessonsContainer"></div>

    </div>
  `;

  document.body.appendChild(modal);

  const lessonsContainer =
    modal.querySelector("#lessonsContainer");

  lessons.forEach(lesson => {

    const row =
      document.createElement("div");

    row.className = "lesson-card";

    row.innerHTML = `
      <h3>
        ${escapeHtml(lesson.title)}
      </h3>

      <p>
        ${escapeHtml(lesson.description || "")}
      </p>

      ${
        lesson.video_url
          ? `
            <video
              controls
              width="100%"
            >
              <source src="${lesson.video_url}">
            </video>
          `
          : ""
      }

      ${
        lesson.pdf_url
          ? `
            <a
              class="btn primary"
              href="${lesson.pdf_url}"
              target="_blank"
            >
              فتح المذكرة
            </a>
          `
          : ""
      }

      <button
        class="btn"
        onclick="completeLesson(${lesson.id})"
      >
        تم الانتهاء من الدرس
      </button>
    `;

    lessonsContainer.appendChild(row);

  });

}

async function completeLesson(lessonId) {

  await fetch("/api/student/progress", {

    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({
      lesson_id: lessonId,
      progress: 100,
      completed: true
    })

  });

  alert("تم حفظ تقدمك ✅");

  loadDashboard();
}

async function activateCode() {

  const code =
    document
      .getElementById("subscriptionCode")
      .value
      .trim();

  if (!code) {
    return;
  }

  const response =
    await fetch(
      "/api/student/activate-code",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          code
        })
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    alert(data.message);
    return;
  }

  alert("تم تفعيل الاشتراك بنجاح ✅");

  loadDashboard();
}

async function loadAnnouncements() {

  const response =
    await fetch("/api/announcements");

  const data =
    await response.json();

  const container =
    document.getElementById(
      "announcementsList"
    );

  container.innerHTML = "";

  data.forEach(item => {

    const card =
      document.createElement("div");

    card.className = "card";

    card.innerHTML = `
      <h3>${escapeHtml(item.title)}</h3>

      <p>
        ${escapeHtml(item.body)}
      </p>
    `;

    container.appendChild(card);

  });

}

function showSection(id) {

  document
    .querySelectorAll(".dash-section")
    .forEach(section => {
      section.style.display = "none";
    });

  document.getElementById(id)
    .style.display = "block";

}

async function logout() {

  await fetch(
    "/api/auth/logout",
    {
      method: "POST"
    }
  );

  window.location.href = "/";
}

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

loadDashboard();