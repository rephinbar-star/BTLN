import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { ID_BY_SLUG, isRelationship, SEGMENT_BY_RELATIONSHIP } from "@/lib/pairTypes";

/**
 * Keeps the older `/types/:slug?as=friend` links working by redirecting to
 * the canonical category URL `/types/:category/:slug`.
 */
const PairTypeLegacyRedirect = () => {
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const as = params.get("as");
  const rel = isRelationship(as) ? as : "romantic";

  if (!ID_BY_SLUG[slug]) return <Navigate to="/types" replace />;
  return <Navigate to={`/types/${SEGMENT_BY_RELATIONSHIP[rel]}/${slug}`} replace />;
};

export default PairTypeLegacyRedirect;
