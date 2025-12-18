import { PlayerEvaluationDetail } from "@/components/PlayerEvaluationDetail";
import { PlayerGuard } from "../../Guard";
export default async function PlayerFilmEvaluationDetailPage(props: { params: Promise<{ filmSubmissionId: string }> }) {
  const { filmSubmissionId } = await props.params;
  return (
    <PlayerGuard>
      <PlayerEvaluationDetail filmSubmissionId={filmSubmissionId} />
    </PlayerGuard>
  );
}


