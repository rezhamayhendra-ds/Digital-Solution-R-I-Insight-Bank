
export interface JournalContent {
  abstract: string;
  introduction: string;
  methodology: string;
  results: string;
  conclusion: string;
  references: string[];
}

export type ContentFormat = 'Article' | 'Journal';
export type ResearchMethod = 'Qualitative' | 'Quantitative' | 'Mixed Methods' | 'Case Study' | 'Literature Review';
export type AuthorName = 'Angga Dwika Sispatradhana' | 'Rezha Mayhendra' | 'Muhammad Tasrifudin';
export type UserRole = 'INTERNAL' | 'DS_TEAM';

export interface User {
  id: string;
  email: string;
  password?: string; // Added for mock auth logic
  fullName: string;
  role: UserRole;
  employeeId?: string;
  department?: string;
  stats: {
    readCount: number;
    downloadCount: number;
  };
}

export interface Comment {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: string;
}

export interface ResearchJournal {
  id: string;
  topic: string;
  industry: string;
  author: AuthorName;
  type: 'Business Forecast' | 'Technology';
  format: ContentFormat;
  method: ResearchMethod;
  status: 'Drafting' | 'Completed';
  createdAt: string;
  english: JournalContent;
  indonesian: JournalContent;
  comments: Comment[];
}

export interface DashboardStats {
  totalResearch: number;
  businessFocus: number;
  techFocus: number;
  recentTopics: string[];
  authorStats: Record<AuthorName, number>;
}