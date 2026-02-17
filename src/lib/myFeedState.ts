export type MyFeedItemState =
  | 'my_feed_published'
  | 'candidate_submitted'
  | 'candidate_pending_manual_review'
  | 'channel_published'
  | 'channel_rejected';

export function getMyFeedStateLabel(state: MyFeedItemState) {
  switch (state) {
    case 'my_feed_published':
      return 'In My Feed';
    case 'candidate_submitted':
      return 'Submitted';
    case 'candidate_pending_manual_review':
      return 'Needs Review';
    case 'channel_published':
      return 'Published to Channel';
    case 'channel_rejected':
      return 'Rejected for Channel';
    default:
      return 'In My Feed';
  }
}

export function isTerminalMyFeedState(state: MyFeedItemState) {
  return state === 'channel_published' || state === 'channel_rejected';
}
