import { ProfileCreated } from "../generated/ProfileRegistry/ProfileRegistry";
import { Profile } from "../generated/schema";

export function handleProfileCreated(event: ProfileCreated): void {
    const id = event.params.user.toHex();
    let profile = Profile.load(id);
    if (profile == null) {
        profile = new Profile(id);
        profile.handle = event.params.handle;
        profile.createdAt = event.block.timestamp;
        profile.save();
    }
}