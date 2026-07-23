# Rose Bloom Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export the existing rose as a GLB with a natural one-shot bloom and play that embedded animation when the rose modal opens.

**Architecture:** A deterministic Blender Python script imports the source GLB, separates the single petal mesh into connected petal islands, assigns attachment pivots, and keyframes staggered object transforms into one `RoseBloom` action. A dependency-free Node verifier checks the binary GLB contract, while a small Three.js helper configures one-shot playback and `ThreeRose` advances its mixer inside the existing render loop.

**Tech Stack:** Blender 5.1 / `bpy`, glTF 2.0 GLB, Node.js, React 19, Three.js 0.183, TypeScript 5.8, Vite 6.

## Global Constraints

- Preserve the current flower stem, leaves, materials, textures, framing, and final open silhouette.
- Animate only the red flower head.
- Embed exactly one glTF animation named `RoseBloom` with a duration near 4.5 seconds.
- Play once, use smooth easing, and hold the final open pose.
- Keep `src/model/rose.glb` and `public/models/rose.glb` byte-identical.
- Do not alter particle timing, lighting, camera controls, rose triggers, or unrelated dirty worktree files.

---

### Task 1: Define the animated GLB contract

**Files:**
- Create: `scripts/verify-rose-glb.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: a file path to a binary glTF 2.0 file.
- Produces: exit code 0 only when the model has `RoseBloom`, animated petal nodes, translation/rotation/scale channels, a 4.0–5.0 second duration, and no animation channel targeting leaf, stem, or thorn nodes.

- [ ] **Step 1: Write the failing verifier**

Implement `readGlb(filePath)` by validating magic `0x46546c67`, version `2`, and extracting JSON and BIN chunks. Resolve accessor scalar values from `bufferViews` using each accessor's `byteOffset`, the buffer view's `byteOffset`, component type `5126`, and count. Locate `json.animations.find(animation => animation.name === 'RoseBloom')`, then assert:

```js
const targets = animation.channels.map((channel) => ({
  node: json.nodes[channel.target.node]?.name ?? '',
  path: channel.target.path,
  sampler: animation.samplers[channel.sampler],
}));

assert(targets.length >= 6, 'RoseBloom must animate multiple petals');
assert(new Set(targets.map(({ node }) => node)).size >= 3,
  'RoseBloom must target at least three petal nodes');
assert(targets.every(({ node }) => node.startsWith('Petal_')),
  'RoseBloom may animate only Petal_* nodes');
assert(['translation', 'rotation', 'scale'].every((path) =>
  targets.some((target) => target.path === path)),
  'RoseBloom must contain translation, rotation, and scale channels');
```

Read each sampler input accessor, take the maximum time, and require `duration >= 4 && duration <= 5`. Require an `OpenPoseBounds` array in the extras of the node named `RoseRoot`, containing six finite numbers for later final-pose comparison. Print `PASS: RoseBloom animation contract verified` on success.

- [ ] **Step 2: Run the verifier against the original model**

Run: `node scripts/verify-rose-glb.mjs public/models/rose.glb`

Expected: exit code 1 with `FAIL: RoseBloom animation is missing`.

- [ ] **Step 3: Add the package command**

Add this script without changing existing commands:

```json
"check:rose-glb": "node scripts/verify-rose-glb.mjs public/models/rose.glb"
```

- [ ] **Step 4: Commit the contract**

```bash
git add scripts/verify-rose-glb.mjs package.json
git commit -m "test: define rose bloom glb contract"
```

### Task 2: Build the reproducible Blender bloom exporter

**Files:**
- Create: `scripts/prepare_rose_bloom.py`
- Modify: `src/model/rose.glb`
- Modify: `public/models/rose.glb`

**Interfaces:**
- Consumes: the current `src/model/rose.glb`; the script supports both the original single-petal-mesh form and its own previously generated `Petal_*` form.
- Produces: both GLB paths above with identical bytes and one action named `RoseBloom`; petal objects are named `Petal_000`, `Petal_001`, and so on.

- [ ] **Step 1: Implement guarded import and petal discovery**

Set `SOURCE_GLB`, `OUTPUT_GLB`, `MIRROR_GLB`, `FPS = 30`, and `END_FRAME = 135`. Reset the scene, import the source, remove imported actions and animation data, and find leaf, stem, and thorn meshes by material. For petals, accept either exactly one mesh using `m_petal` or at least three existing `Petal_*` meshes using that material. Record the combined original world-space bounds before modifying the petal objects. This makes rerunning the exporter deterministic after the first generated GLB replaces the source.

- [ ] **Step 2: Separate connected petal islands**

When the source contains one petal mesh, activate it, enter Edit mode, select all, and run:

```python
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
petals = sorted(
    [obj for obj in bpy.context.selected_objects if obj.type == "MESH"],
    key=lambda obj: tuple(round(value, 6) for value in obj.bound_box[0]),
)
if len(petals) < 3:
    raise RuntimeError(f"Expected at least 3 petal islands, found {len(petals)}")
```

When the source already contains `Petal_*` objects, reuse them instead of separating again. In both paths, sort by the world-space centroid's rounded polar angle, radial distance, and Z coordinate; then rename sequentially and retain the existing `m_petal` material.

- [ ] **Step 3: Assign attachment pivots and animation layers**

For every petal, compute world-space vertices, its centroid, its minimum-Z attachment band (the lowest 12% of its Z range), and use the mean of that band as its origin while preserving world transforms. Compute the flower center from all petal centroids. Classify normalized radial distance into `outer >= 0.66`, `middle >= 0.33`, and `inner < 0.33`.

Store the exact open transform. Derive the closed transform by moving 18%, 13%, or 8% toward the flower axis for outer, middle, or inner petals; scaling XY by 0.72, 0.80, or 0.88 while keeping Z at 0.94, 0.97, or 0.99; and applying a quaternion rotation toward the axis with maximum angles of 38°, 28°, or 16°. Use a deterministic stagger from the petal index.

- [ ] **Step 4: Keyframe the closed, overlap, and open poses**

Use layer start frames 1, 18, and 34 for outer, middle, and inner petals. Insert the closed transform at that layer's start and the recorded open transform at `start + 82`, capped at frame 135. Insert all three transform paths using:

```python
for path in ("location", "rotation_quaternion", "scale"):
    petal.keyframe_insert(data_path=path, frame=start)
    # restore the recorded open transform before the second insertion
    petal.keyframe_insert(data_path=path, frame=end)
```

Put each petal action into a single NLA track named `RoseBloom` and export NLA tracks merged by track name so glTF contains one clip. Set all generated F-curves to `BEZIER` with `AUTO_CLAMPED` handles and scene frame range 1–135. Verify in the script that only `Petal_*` objects have animation data.

- [ ] **Step 5: Export without changing the final silhouette**

At frame 135, recompute world-space petal bounds and reject export when any bound differs from the recorded original by more than `1e-4`. Create or reuse a hierarchy root named `RoseRoot`, store the six bounds in `root['OpenPoseBounds']`, and export the complete hierarchy as GLB with materials, UVs, normals, animations, NLA-track merging, and custom-property extras enabled. Copy the final bytes to the mirror path with `shutil.copyfile`.

- [ ] **Step 6: Run Blender and verify output**

Run:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/prepare_rose_bloom.py
npm run check:rose-glb
shasum -a 256 src/model/rose.glb public/models/rose.glb
```

Expected: Blender exits 0; the verifier prints its PASS line; both checksums match.

- [ ] **Step 7: Commit the generated model and exporter**

```bash
git add scripts/prepare_rose_bloom.py src/model/rose.glb public/models/rose.glb
git commit -m "feat: embed rose bloom animation"
```

### Task 3: Add one-shot Three.js playback

**Files:**
- Create: `src/lib/rose-animation.ts`
- Create: `scripts/check-rose-animation.ts`
- Modify: `src/components/ThreeRose.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces:

```ts
export function createRoseBloomAction(
  root: THREE.Object3D,
  animations: readonly THREE.AnimationClip[],
): { mixer: THREE.AnimationMixer; action: THREE.AnimationAction } | null;
```

- [ ] **Step 1: Write failing behavior checks**

Create a group and a 4.5-second `RoseBloom` clip, call `createRoseBloomAction`, and assert the result is non-null, `action.loop === THREE.LoopOnce`, `action.repetitions === 1`, `action.clampWhenFinished === true`, and `action.isRunning() === true`. Also assert an empty animation array returns `null`.

- [ ] **Step 2: Run the check before implementation**

Run: `npx tsx scripts/check-rose-animation.ts`

Expected: FAIL because `src/lib/rose-animation.ts` does not exist.

- [ ] **Step 3: Implement the minimal playback helper**

```ts
export function createRoseBloomAction(root, animations) {
  const clip = THREE.AnimationClip.findByName(animations, 'RoseBloom') ?? animations[0];
  if (!clip) return null;
  const mixer = new THREE.AnimationMixer(root);
  const action = mixer.clipAction(clip);
  action.setLoop(THREE.LoopOnce, 1);
  action.clampWhenFinished = true;
  action.reset().play();
  return { mixer, action };
}
```

- [ ] **Step 4: Integrate with the existing rose lifecycle**

In `ThreeRose.tsx`, create one `THREE.Clock`, retain `let roseAnimation: ReturnType<typeof createRoseBloomAction> = null`, and after `modelGroup.add(model)` call `createRoseBloomAction(model, gltf.animations)`. In `animate`, compute one clamped delta and call `roseAnimation?.mixer.update(delta)` before rendering. In cleanup, call `roseAnimation?.action.stop()` and `roseAnimation?.mixer.uncacheRoot(model)` when the model exists. Do not change the current 2.5-second particle phase, 2.5-second fade, orbit rotation, or controls.

- [ ] **Step 5: Add and run static checks**

Add:

```json
"check:rose-animation": "tsx scripts/check-rose-animation.ts"
```

Run:

```bash
npm run check:rose-animation
npm run lint
npm run build
```

Expected: the behavior check prints `PASS: rose bloom playback is one-shot and clamped`; TypeScript and Vite exit 0.

- [ ] **Step 6: Commit runtime playback**

```bash
git add src/lib/rose-animation.ts scripts/check-rose-animation.ts src/components/ThreeRose.tsx package.json
git commit -m "feat: play rose bloom once"
```

### Task 4: Visual acceptance

**Files:**
- Create: `output/rose-bloom/closed.png`
- Create: `output/rose-bloom/mid-bloom.png`
- Create: `output/rose-bloom/open.png`

**Interfaces:**
- Consumes: the exported rose model and local Vite application.
- Produces: visual evidence for the closed, mid-bloom, and final poses.

- [ ] **Step 1: Render Blender checkpoints**

Import the final GLB in a clean Blender process and render frames 1, 68, and 135 from a fixed three-quarter camera. Confirm frame 1 reads as a compact bud, frame 68 has visibly staggered layers, frame 135 matches the original open rose, and stem/leaves remain unchanged.

- [ ] **Step 2: Verify in the browser**

Start Vite on `127.0.0.1:3000`, clear the local model cache, trigger the rose modal, and confirm the bloom becomes visible during the existing particle-to-model transition, finishes once, and stays open. Close and reopen the modal and confirm it restarts from the closed pose.

- [ ] **Step 3: Check console and interaction health**

Confirm there are no GLTFLoader, animation binding, WebGL, or React cleanup errors; orbit controls remain usable after blooming; clicking without dragging still closes the modal; dragging does not close it.

- [ ] **Step 4: Run the final verification suite**

```bash
npm run check:rose-glb
npm run check:rose-animation
npm run lint
npm run build
shasum -a 256 src/model/rose.glb public/models/rose.glb
```

Expected: every command exits 0 and both GLB checksums match.
