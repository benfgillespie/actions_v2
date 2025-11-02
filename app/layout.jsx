export const metadata = {
  title: "Task Tracker",
  description: "Tasks with cloud persistence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f6f7f9" }}>{children}</body>
    </html>
  );
}
