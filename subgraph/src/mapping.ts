import { ProfileCreated } from "../generated/ProfileRegistry/ProfileRegistry";
import { Profile } from "../generated/schema";

export function handleProfileCreated(event: ProfileCreated): void {
    const id = event.params.user.toHex();
    let profile = Profile.load(id);
    if (profile == null) {
        profile = new Profile(id);
        profile.handle = event.params.handle;
        // Type assertion to access block timestamp without TS error
        const timestamp = (event as unknown as { block: { timestamp: BigInt } }).block.timestamp;
        profile.createdAt = timestamp;
        profile.save();
    }
}