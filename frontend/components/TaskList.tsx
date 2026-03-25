"use client";

export interface Task {
    id: number;
    taskName: string;
    dueDate: string;
    status: string;
}

interface TaskListProps {
    tasks: Task[];
}

export default function TaskList({ tasks }: TaskListProps) {
    if (!tasks || tasks.length === 0) {
        return (
            <div className="mt-6 p-4 bg-white rounded-lg shadow text-gray-500">
                No maintenance tasks available.
            </div>
        );
    }

    return (
        <div className="mt-6 bg-white rounded-xl shadow overflow-hidden">
            <table className="min-w-full">
                <thead className="bg-gray-100 text-left text-sm font-semibold text-gray-700">
                    <tr>
                        <th className="p-4">Task</th>
                        <th className="p-4">Due Date</th>
                        <th className="p-4">Status</th>
                    </tr>
                </thead>

                <tbody>
                    {tasks.map((task) => (
                        <tr
                            key={task.id}
                            className="border-t hover:bg-gray-50 transition"
                        >
                            <td className="p-4 font-medium text-gray-800">
                                {task.taskName}
                            </td>

                            <td className="p-4 text-gray-600">
                                {task.dueDate}
                            </td>

                            <td className="p-4">
                                <span
                                    className={`px-3 py-1 rounded-full text-xs font-semibold ${task.status === "Urgent"
                                        ? "bg-red-100 text-red-600"
                                        : task.status === "Pending"
                                            ? "bg-yellow-100 text-yellow-600"
                                            : "bg-green-100 text-green-600"
                                        }`}
                                >
                                    {task.status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
