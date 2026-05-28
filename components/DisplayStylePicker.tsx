export function DisplayStylePicker({ featured = false }: { featured?: boolean }) {
  return (
    <fieldset className="field md:col-span-2">
      <legend>Display style</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-black/10 bg-white p-3">
          <input className="mt-1" type="radio" name="featured" value="false" defaultChecked={!featured} />
          <span>
            <span className="block font-bold">Standard</span>
            <span className="text-xs text-black/55">Compact row with thumbnail and title.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-md border border-black/10 bg-white p-3">
          <input className="mt-1" type="radio" name="featured" value="true" defaultChecked={featured} />
          <span>
            <span className="block font-bold">Featured</span>
            <span className="text-xs text-black/55">Large card with full-width image or video.</span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}
