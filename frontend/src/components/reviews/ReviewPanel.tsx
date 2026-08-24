import { useState } from 'react';
import { useAuth } from '../../features/auth/useAuth';
import { useReviewEligibility, useReviewMutations, useReviews } from '../../features/reviews/hooks';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Spinner } from '../ui/Spinner';
import { getApiErrorMessage } from '../../api/error';

export function ReviewPanel({ productId }: { productId: string }) {
  const { user } = useAuth();
  const reviews = useReviews(productId);
  const eligibility = useReviewEligibility(productId, user?.role === 'CUSTOMER');
  const mutations = useReviewMutations(productId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const existing = eligibility.data?.existingReview;
  const canWrite = eligibility.data?.eligible || (existing && editing);
  const submit = () => {
    setError(null);
    const options = { onSuccess: () => setEditing(false), onError: (e: Error) => setError(getApiErrorMessage(e)) };
    if (existing) mutations.update.mutate({ id: existing.id, rating, comment }, options);
    else if (eligibility.data?.sellerOrderItemId) mutations.create.mutate({ sellerOrderItemId: eligibility.data.sellerOrderItemId, rating, comment }, options);
  };
  return (
    <section className="md:col-span-2 flex flex-col gap-4 border-t border-line pt-8">
      <div><h2 className="font-display text-xl font-semibold text-navy">Verified buyer notes</h2><p className="text-sm text-navy/60">Receipts checked. Opinions still delightfully personal.</p></div>
      {user?.role === 'CUSTOMER' && eligibility.isLoading && <Spinner label="Checking your purchase…" />}
      {existing && !editing && <Card className="flex items-center justify-between gap-4 border-cargo-yellow bg-cargo-yellow/10 p-4"><div><p className="font-semibold text-navy">Your review · {'★'.repeat(existing.rating)}</p><p className="text-sm text-navy/70">{existing.comment}</p></div><div className="flex gap-2"><Button size="sm" variant="ghost" onClick={() => { setRating(existing.rating); setComment(existing.comment ?? ''); setEditing(true); }}>Edit</Button><Button size="sm" variant="danger" onClick={() => mutations.remove.mutate(existing.id)}>Delete</Button></div></Card>}
      {canWrite && <Card className="grid gap-3 p-4 md:grid-cols-[160px_1fr_auto]"><label className="text-sm font-medium text-navy">Rating<select value={rating} onChange={(e) => setRating(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2">{[5,4,3,2,1].map((n) => <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>)}</select></label><label className="text-sm font-medium text-navy">Comment<textarea value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-line p-3" placeholder="What should the next buyer know?" /></label><div className="flex items-end gap-2"><Button disabled={!comment.trim() || mutations.create.isPending || mutations.update.isPending} onClick={submit}>{existing ? 'Save' : 'Post review'}</Button>{editing && <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>}</div>{error && <p className="text-sm text-coral md:col-span-3">{error}</p>}</Card>}
      {!canWrite && !existing && user?.role === 'CUSTOMER' && !eligibility.isLoading && <p className="text-sm text-navy/50">Reviewing unlocks after a delivered, non-fully-refunded purchase.</p>}
      {reviews.isLoading ? <Spinner label="Loading reviews…" /> : reviews.data?.data.length ? <div className="grid gap-3 md:grid-cols-2">{reviews.data.data.map((review) => <Card key={review.id} className="p-4"><div className="flex justify-between"><p className="font-semibold text-navy">{review.customerDisplayName}</p><span className="text-cargo-yellow-dark">{'★'.repeat(review.rating)}</span></div><p className="mt-2 text-sm text-navy/70">{review.comment ?? 'Rating only'}</p><p className="mt-3 text-xs text-navy/40">Verified purchase · {new Date(review.createdAt).toLocaleDateString()}</p></Card>)}</div> : <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-navy/50">No buyer notes yet. This crate is waiting for its first field report.</p>}
    </section>
  );
}
