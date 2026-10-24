import { useQuery } from "@apollo/client";
import { useQueryState } from "erxes-ui";
import { useEffect, useMemo } from "react";
import { CLASS_LIST } from "../graphql/classes";

// The class every page works on: `?classId=` in the URL, falling back to the
// last class this browser used, then to the newest class. The remembered id
// is a per-browser convenience only.
const STORAGE_KEY = "edureport.classId";

const readStored = (): string | null => {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const store = (classId: string) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, classId);
  } catch {
    // Storage can be unavailable (private mode, blocked site data).
  }
};

// The API returns at most 100 classes per page; a teacher has far fewer.
export const CLASS_LIST_VARIABLES = { perPage: 100 };

export const useCurrentClass = () => {
  const { data, loading, error, refetch } = useQuery(CLASS_LIST, {
    variables: CLASS_LIST_VARIABLES,
  });
  const [rawClassId, setClassId] = useQueryState<string>("classId");

  const classes = useMemo(() => data?.edureportClassList.list ?? [], [data]);
  const ids = classes.map(({ _id }) => _id).join(",");
  // useQueryState JSON-parses values, so an all-digit id would come back as a number.
  const requested = rawClassId === null ? null : String(rawClassId);
  const current = classes.find(({ _id }) => _id === requested) ?? null;

  useEffect(() => {
    if (!data) {
      return;
    }

    if (current) {
      store(current._id);

      return;
    }

    const stored = readStored();
    const fallback = classes.find(({ _id }) => _id === stored) ?? classes[0];

    if ((fallback?._id ?? null) !== requested) {
      setClassId(fallback?._id ?? null);
    }
    // `ids` stands for `classes`; rerun only when the set of classes changes.
  }, [data, ids, current, requested, setClassId]);

  return { classes, current, setClassId, loading, error, refetch };
};
