import { useMutation } from "@apollo/client";
import { useState } from "react";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import { Button, Card, toast, useConfirm } from "erxes-ui";
import { CLASS_LIST, CLASS_REMOVE } from "../../graphql/classes";
import type { EdureportClassDetailQuery } from "../../gql/graphql";
import { formatDateTime } from "../../lib/dates";
import { ClassFormDialog } from "../ClassFormDialog";
import { CLASS_LIST_VARIABLES } from "../useCurrentClass";

type ClassDetail = EdureportClassDetailQuery["edureportClassDetail"];

// SPEC §3 defaults when a class has no threshold of its own.
export const DEFAULT_ATTENDANCE_THRESHOLD = 80;
export const DEFAULT_SCORE_THRESHOLD = 60;

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="edureport:flex edureport:items-center edureport:justify-between edureport:gap-3 edureport:text-sm">
    <span className="edureport:text-muted-foreground">{label}</span>
    <span className="edureport:text-right edureport:font-medium">{value}</span>
  </div>
);

export const ClassInfoCard = ({ cls }: { cls: ClassDetail }) => {
  const [editing, setEditing] = useState(false);
  const { confirm } = useConfirm();
  const [removeClass, { loading: removing }] = useMutation(CLASS_REMOVE, {
    refetchQueries: [{ query: CLASS_LIST, variables: CLASS_LIST_VARIABLES }],
    awaitRefetchQueries: true,
  });

  const remove = async () => {
    await confirm({
      message: `${cls.name} ангийг устгах уу?`,
      options: {
        description: "Сурагч, ирц, даалгавар, эссэ, тайлан бүгд хамт устна. Буцаах боломжгүй.",
        okLabel: "Устгах",
        cancelLabel: "Болих",
        variants: { ok: "destructive" },
      },
    });

    try {
      await removeClass({ variables: { _id: cls._id } });
      toast({ title: `${cls.name} анги устлаа`, variant: "success" });
    } catch (error) {
      toast({
        title: "Устгаж чадсангүй",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title className="edureport:text-base">Ангийн мэдээлэл</Card.Title>
        <Card.Description>
          {cls.name} · {cls.subject}
        </Card.Description>
      </Card.Header>
      <Card.Content className="edureport:flex edureport:flex-col edureport:gap-2.5">
        <Row label="Хичээл" value={cls.subject} />
        <Row label="Улирал" value={cls.term} />
        <Row label="Түвшин" value={cls.grade || "—"} />
        <Row label="Сурагч" value={String(cls.studentCount)} />
        <Row
          label="Ирцийн босго"
          value={`${cls.atRiskAttendancePct ?? DEFAULT_ATTENDANCE_THRESHOLD}%`}
        />
        <Row label="Онооны босго" value={`${cls.atRiskScorePct ?? DEFAULT_SCORE_THRESHOLD}%`} />
        <Row label="Үүсгэсэн" value={formatDateTime(cls.createdAt)} />
        <div className="edureport:mt-2 edureport:flex edureport:gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <IconPencil />
            Засах
          </Button>
          <Button variant="ghost" size="sm" onClick={remove} disabled={removing}>
            <IconTrash />
            Устгах
          </Button>
        </div>
      </Card.Content>
      <ClassFormDialog open={editing} onOpenChange={setEditing} cls={cls} />
    </Card>
  );
};
