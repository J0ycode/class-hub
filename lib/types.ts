export type Video = {
  id: string;
  title: string;
  label: string;
  yt: string;
  duration: number;
  order: number;
};

export type Module = {
  id: string;
  name: string;
  fullName: string;
  videos: Video[];
};

export type Subject = {
  id: string;
  name: string;
  code: string;
  fullName: string;
  course: string;
  modules: Module[];
  videoCount: number;
  totalSeconds: number;
};

export type Note = {
  id: string;
  subjectId: string;
  moduleId: string;
  subjectName: string;
  chapterName: string;
  title: string;
  order: number;
  file: string;
  sourceUrl: string;
};

export type Catalogue = {
  generatedAt: string;
  courses: string[];
  totalVideos: number;
  totalSeconds: number;
  subjects: Subject[];
  notes: Note[];
};

export type ProgressEntry = {
  position: number;
  watched: number;
  duration: number;
  percent: number;
  completed: boolean;
  updatedAt: number;
};

export type ProgressMap = Record<string, ProgressEntry>;
