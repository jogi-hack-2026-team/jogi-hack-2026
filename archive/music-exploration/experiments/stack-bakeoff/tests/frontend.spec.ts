import { test, expect, type Page } from "@playwright/test";
async function seed(page: Page, live = false) {
  await page.goto("/" + (live ? "?mode=live" : ""));
  await expect(
    page.getByRole("button", { name: "Start exploration" }),
  ).toBeDisabled();
  for (let i = 1; i <= 3; i++)
    await page
      .getByRole("button", { name: `Select Track ${i}`, exact: true })
      .click();
  await page.getByRole("button", { name: "Start exploration" }).click();
  await expect(
    page.getByRole("heading", { name: "Exploration", exact: true }),
  ).toBeVisible();
}
test("search, seed minimum/maximum and guest reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("Loading");
  await expect(
    page.getByRole("button", { name: "Start exploration" }),
  ).toBeDisabled();
  for (let i = 1; i <= 5; i++)
    await page
      .getByRole("button", { name: `Select Track ${i}`, exact: true })
      .click();
  await expect(
    page.getByRole("button", { name: "Select Track 6", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByText("5 / 5 selected")).toBeVisible();
  await page.getByLabel("Search tracks").fill("Artist 2");
  await expect(
    page.getByRole("button", { name: "Select Track 1", exact: true }),
  ).toHaveCount(0);
});
test("error retry and damaged local guest recovery", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Search tracks").fill("error");
  await expect(
    page.getByRole("alert", { name: "Request error" }),
  ).toContainText("Mock search failure");
  await page.getByLabel("Search tracks").fill("Track 1");
  await expect(
    page.getByRole("button", { name: "Select Track 1", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => localStorage.setItem("bakeoff-mock-v1", "{bad"));
  await page.reload();
  await expect(page.getByText("0 / 5 selected")).toBeVisible();
});
test("four feedback values, playback failure, revision and five-track checkpoint", async ({
  page,
}) => {
  await seed(page);
  await page.getByRole("button", { name: "Simulate playback failure" }).click();
  await expect(
    page.getByText("Playback unavailable. This is not a dislike."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next recommendation" }),
  ).toBeDisabled();
  for (const rating of ["LIKE", "NEUTRAL", "DISLIKE", "UNSURE"]) {
    await page.getByRole("button", { name: rating, exact: true }).click();
    await expect(
      page.getByText(`Saved: ${rating}`, { exact: true }),
    ).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText("Saved: UNSURE", { exact: true })).toBeVisible();
  for (let n = 2; n <= 5; n++) {
    await page.getByRole("button", { name: "Next recommendation" }).click();
    await expect(
      page.getByText(`Track ${n} / 5`, { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "NEUTRAL", exact: true }).click();
    await expect(
      page.getByText("Saved: NEUTRAL", { exact: true }),
    ).toBeVisible();
  }
  await expect(
    page.getByRole("heading", { name: "Preference summary" }),
  ).toBeVisible();
  await page.screenshot({
    path: `results/local-${test.info().project.name}-checkpoint.png`,
    fullPage: true,
  });
});
test("render error boundary preserves saved guest", async ({ page }) => {
  await seed(page);
  await page.getByRole("button", { name: "Simulate render error" }).click();
  await expect(
    page.getByRole("heading", { name: "Screen unavailable" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reload saved guest state" }).click();
  await expect(page.getByText("Track 1 / 5", { exact: true })).toBeVisible();
});
test("winner integration: actual HTTP, commit, feedback, next and reload", async ({
  page,
}, info) => {
  test.skip(
    info.project.name !== "vite",
    "Only the recommended pair is integrated; no cross-product bake-off.",
  );
  await seed(page, true);
  await page.getByRole("button", { name: "LIKE", exact: true }).click();
  await expect(page.getByText("Saved: LIKE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next recommendation" }).click();
  await expect(page.getByText("Track 2 / 5", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Track 2 / 5", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "results/local-integration.png",
    fullPage: true,
  });
});
