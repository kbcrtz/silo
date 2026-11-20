import { backupProfile, backupSaved, fetchBackup } from "@/api/userData";
import { startBackups } from "@/hooks/useCloudSync";
import { useMeasurements } from "@/store/measurements";
import { useProfile } from "@/store/profile";
import { useSaved } from "@/store/saved";

jest.mock("@/api/userData", () => ({
  fetchBackup: jest.fn(),
  backupProfile: jest.fn(() => Promise.resolve()),
  backupSaved: jest.fn(() => Promise.resolve()),
  backupMeasurements: jest.fn(() => Promise.resolve()),
  uploadPhoto: jest.fn(() => Promise.resolve()),
  downloadPhoto: jest.fn(() => Promise.resolve(null)),
}));

const settle = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
  jest.advanceTimersByTime(2500); // past the backups' debounce
};

describe("startBackups on a signed-in empty phone", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    useProfile.getState().reset();
    useSaved.getState().clear();
    useMeasurements.getState().replaceAll([]);
  });
  afterEach(() => jest.useRealTimers());

  it("uploads nothing when the account can't be read, so it isn't overwritten", async () => {
    jest.mocked(fetchBackup).mockRejectedValue(new Error("502"));
    const stop = startBackups();
    await settle();
    expect(backupProfile).not.toHaveBeenCalled();
    expect(backupSaved).not.toHaveBeenCalled();
    stop();
  });

  it("puts the account on the phone before the first upload", async () => {
    jest.mocked(fetchBackup).mockResolvedValue({
      profile: { onboarded: true, displayName: "Ada" },
      saved: null,
      measurements: [],
    });
    const stop = startBackups();
    await settle();
    expect(backupProfile).toHaveBeenCalledWith(
      expect.objectContaining({ onboarded: true, displayName: "Ada" }),
    );
    stop();
  });
});
