import { IconCalendarCheck } from "@tabler/icons-react";
import { AttendanceWeek } from "../modules/attendance/AttendanceWeek";
import { ClassBar } from "../modules/ClassBar";
import { PageShell } from "../modules/PageShell";
import { useCurrentClass } from "../modules/useCurrentClass";

export const AttendancePage = () => {
  const currentClass = useCurrentClass();
  const classId = currentClass.current?._id;

  return (
    <PageShell title="Ирцийн бүртгэл" icon={IconCalendarCheck} iconName="IconCalendarCheck" to="attendance">
      <ClassBar {...currentClass} />
      {classId && <AttendanceWeek key={classId} classId={classId} />}
    </PageShell>
  );
};
