/**
 * FC SBC squad rating formula.
 *
 * The squad is always treated as 11 cards, then a correction factor is added
 * for cards above the average rating before flooring the final result.
 */
export function calculateSbcTeamRating(ratings: number[]): number {
  if (ratings.length === 0) return 0;

  const paddedRatings = [...ratings];
  while (paddedRatings.length < 11) {
    paddedRatings.push(0);
  }

  const sum = paddedRatings.reduce((acc, rating) => acc + rating, 0);
  const average = sum / 11;
  const correction = paddedRatings.reduce((acc, rating) => {
    return rating > average ? acc + (rating - average) : acc;
  }, 0);

  return Math.floor(Math.round(sum + correction) / 11);
}
