import TaskTracker from "../components/TaskTracker";

export default function Page() {
  return (
    <main style={{ minHeight: "100vh", background: "#f6f7f9", padding: 16 }}>
      {/* Task Tracker */}
      <TaskTracker />
    </main>
  );
}
