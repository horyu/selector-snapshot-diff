import type { SlotSnapshot, StoredImage } from './history';
import type { ImgSlot } from '../slots/slots';

export function toSlotSnapshot(slot: NonNullable<ImgSlot>): SlotSnapshot {
  return {
    file: slot.file,
    name: slot.name,
    type: slot.type,
    label: slot.label,
    source: slot.source,
  };
}

export function createFileFromStored(image: StoredImage): File {
  const name =
    image.name && image.name.trim().length ? image.name : 'screenshot.png';
  const type = image.type || image.blob.type || 'image/png';
  return new File([image.blob], name, { type });
}
