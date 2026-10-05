import { useState } from 'react';
import { LocateFixed } from 'lucide-react';
import toast from 'react-hot-toast';
import { Input, Select, Textarea } from '@/components/forms/Fields';
import { PACKAGE_SIZES, PRIORITIES } from '@/features/deliveries/status';
import { getCurrentPosition, reverseGeocode } from '@/services/geo';

function LocateButton({ onLocated }) {
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const pos = await getCurrentPosition();
      const address = await reverseGeocode(pos);
      onLocated(pos, address);
      toast.success(address ? 'Location added' : 'Location pinned. Type the street address too.');
    } catch (e) {
      toast.error(e.message);
    } finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={go} disabled={busy} className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline disabled:opacity-60">
      <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />{busy ? 'Locating…' : 'Use my current location'}
    </button>
  );
}

/** Pickup / drop-off / item fields shared by customer request and SME create-delivery forms (react-hook-form). */
export function DeliveryFields({ register, errors, setValue, watch, showPickup = true }) {
  const pinned = (k) => watch(`${k}_lat`) != null;
  const locate = (k) => (pos, address) => {
    setValue(`${k}_lat`, pos.lat, { shouldDirty: true });
    setValue(`${k}_lng`, pos.lng, { shouldDirty: true });
    if (address) setValue(`${k}_address`, address.slice(0, 300), { shouldValidate: true, shouldDirty: true });
  };
  const clearPin = (k) => () => { setValue(`${k}_lat`, null); setValue(`${k}_lng`, null); };
  return (
    <div className="space-y-5">
      {showPickup && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-navy-900">Pickup details</legend>
          <Input label="Pickup address" required placeholder="e.g. 12 Allen Avenue, Ikeja" error={errors.pickup_address?.message}
            {...register('pickup_address', { onChange: clearPin('pickup') })} />
          <div className="flex items-center justify-between"><LocateButton onLocated={locate('pickup')} />{pinned('pickup') && <span className="text-xs text-emerald-600">Pinned on map</span>}</div>
        </fieldset>
      )}
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-navy-900">Drop-off details</legend>
        <Input label="Drop-off address" required placeholder="e.g. 3 Admiralty Way, Lekki" error={errors.dropoff_address?.message}
          {...register('dropoff_address', { onChange: clearPin('dropoff') })} />
        <div className="flex items-center justify-between"><LocateButton onLocated={locate('dropoff')} />{pinned('dropoff') && <span className="text-xs text-emerald-600">Pinned on map</span>}</div>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="mb-2 text-sm font-semibold text-navy-900">Item details</legend>
        <Input label="What is being delivered?" required placeholder="e.g. Documents, parcel, products" error={errors.item_description?.message} {...register('item_description')} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Package size" options={PACKAGE_SIZES} error={errors.package_size?.message} {...register('package_size')} />
          <Select label="Priority" options={PRIORITIES} error={errors.priority?.message} {...register('priority')} />
        </div>
        <Textarea label="Additional notes (optional)" placeholder="Any special instructions?" error={errors.special_instructions?.message} maxLength={500} {...register('special_instructions')} />
      </fieldset>
    </div>
  );
}

export const deliveryDefaults = {
  pickup_address: '', pickup_lat: null, pickup_lng: null,
  dropoff_address: '', dropoff_lat: null, dropoff_lng: null,
  item_description: '', package_size: 'small', priority: 'standard', special_instructions: '',
};
