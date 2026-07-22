export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="h-8 w-8 rounded-full border-2 border-gray-200 border-t-purple-600 animate-spin" />
    </div>
  );
}
