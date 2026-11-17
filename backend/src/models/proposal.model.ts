export type ProposalCategory =
  | 'food'
  | 'sightseeing'
  | 'culture'
  | 'nature'
  | 'nightlife'
  | 'shopping'
  | 'transport'
  | 'other';

export type ProposalStatus =
  'open' | 'tied' | 'approved' | 'rejected' | 'rejected_conflict';

export type ProposalVoteValue = 'for' | 'against';

export interface Proposal {
  id: string;
  tripId: string;
  authorId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  category: ProposalCategory;
  day: string;
  startTime: string;
  endTime: string;
  note: string | null;
  votingDeadline: Date;
  status: ProposalStatus;
  createdAt: Date;
}

export interface ProposalWithVotes {
  id: string;
  placeName: string;
  category: ProposalCategory;
  day: string;
  startTime: string;
  endTime: string;
  votingDeadline: Date;
  status: ProposalStatus;
  forVotes: number;
  againstVotes: number;
  userVote: ProposalVoteValue | null;
}

export interface ProposalVoteResult {
  proposalId: string;
  forVotes: number;
  againstVotes: number;
  userVote: ProposalVoteValue | null;
}

export interface NewProposal {
  tripId: string;
  authorId: string;
  placeName: string;
  latitude: number;
  longitude: number;
  category: ProposalCategory;
  day: string;
  startTime: string;
  endTime: string;
  note: string | null;
  votingDurationHours: number;
  status: Extract<ProposalStatus, 'open' | 'approved'>;
}
