type PageNoticeProps = {
  error?: string;
  success?: string;
};

export function PageNotice({ error, success }: PageNoticeProps) {
  if (!error && !success) return null;

  return (
    <>
      {error ? (
        <div className="notice-error mb-5 rounded-lg p-4 text-sm font-semibold leading-6 shadow-sm">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="notice-success mb-5 rounded-lg p-4 text-sm font-semibold leading-6 shadow-sm">
          {success}
        </div>
      ) : null}
    </>
  );
}
