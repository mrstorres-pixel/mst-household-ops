type PageNoticeProps = {
  error?: string;
  success?: string;
};

export function PageNotice({ error, success }: PageNoticeProps) {
  if (!error && !success) return null;

  return (
    <>
      {error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mb-5 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-800">
          {success}
        </div>
      ) : null}
    </>
  );
}
