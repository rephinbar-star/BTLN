import { Link, useSearchParams } from "react-router-dom";
import logoAsset from "@/assets/logo.png.asset.json";

const ErrorPage = () => {
  const [params] = useSearchParams();
  const reason = params.get("reason") ?? "";

  let body = "We couldn't complete your analysis.";
  if (reason === "not_found") {
    body = "We couldn't find that report. It may have been removed.";
  } else if (reason === "timeout") {
    body =
      "Your analysis took longer than expected and we lost track of it. Please try again — your messages weren't stored.";
  } else if (reason) {
    body = reason;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center text-foreground">
      <div className="flex items-center gap-2">
        <img src={logoAsset.url} alt="BetweenTheLines™" className="h-8 w-auto" />
      </div>
      <h1 className="mt-8 text-[28px] font-medium tracking-tight sm:text-[36px]">
        Something went wrong.
      </h1>
      <p className="mt-4 max-w-md text-[15px] text-muted-foreground">{body}</p>
      <Link
        to="/#input-section"
        className="mt-8 inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-7 py-3.5 text-base font-medium text-background transition-opacity hover:opacity-90"
      >
        Try again
      </Link>
      <p className="mt-6 max-w-md text-[12px] text-muted-foreground">
        If this keeps happening, let us know via the Feedback link in the footer.
      </p>
    </div>
  );
};

export default ErrorPage;