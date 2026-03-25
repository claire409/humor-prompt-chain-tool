import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Assignment: all calls use https://api.almostcrackd.ai — override with ALMOSTCRACKD_API_BASE (no trailing slash). */
const FALLBACK_API_BASES = ['https://api.almostcrackd.ai'] as const;

function uniqueBases(preferred?: string | null): string[] {
  const out: string[] = [];
  const add = (b: string) => {
    const x = b.replace(/\/$/, '');
    if (x && !out.includes(x)) out.push(x);
  };
  if (preferred?.trim()) add(preferred.trim());
  for (const b of FALLBACK_API_BASES) add(b);
  return out;
}

const CAPTION_TARGET = 5;
const MAX_GENERATE_ATTEMPTS = 5;

/** Pairs id + text so we never misalign ids with strings when trimming batches. */
function parseCaptionPairs(data: unknown): { id?: string; text: string }[] {
  if (data == null) return [];
  if (typeof data === 'string') return [{ text: data }];

  if (Array.isArray(data)) {
    const out: { id?: string; text: string }[] = [];
    for (const item of data) {
      if (typeof item === 'string') {
        out.push({ text: item });
        continue;
      }
      if (item && typeof item === 'object') {
        const o = item as Record<string, unknown>;
        const id = o.id != null ? String(o.id) : undefined;
        const text = o.content ?? o.caption ?? o.text ?? o.body ?? o.message;
        if (typeof text === 'string' && text.trim() !== '') {
          out.push({ id, text });
          continue;
        }
      }
    }
    return out;
  }

  if (typeof data === 'object') {
    const o = data as Record<string, unknown>;
    for (const k of ['captions', 'data', 'results', 'items', 'rows', 'output']) {
      if (k in o && o[k] != null) {
        const inner = parseCaptionPairs(o[k]);
        if (inner.length) return inner;
      }
    }
  }
  return [];
}

function captionRequestBody(need: number, imageId: string | number, humorFlavorId: number) {
  return {
    imageId,
    humorFlavorId,
    count: need,
    numCaptions: need,
    numberOfCaptions: need,
    maxCaptions: need,
    n: need,
    captionCount: need,
    desiredCaptions: need,
    targetCount: need,
  };
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin, is_matrix_admin')
    .eq('id', user.id)
    .single();

  if (!profile?.is_superadmin && !profile?.is_matrix_admin) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  const bearer =
    process.env.ALMOSTCRACKD_API_TOKEN?.trim() || session?.access_token || null;
  if (!bearer) {
    return NextResponse.json(
      { success: false, error: 'No API token or session available' },
      { status: 401 }
    );
  }

  const authHeaders = {
    Authorization: `Bearer ${bearer}`,
    'Content-Type': 'application/json',
  } as const;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('image');
  const flavorIdRaw = formData.get('humorFlavorId');

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ success: false, error: 'Missing image file' }, { status: 400 });
  }

  const humorFlavorId =
    typeof flavorIdRaw === 'string' && flavorIdRaw.trim() !== ''
      ? parseInt(flavorIdRaw, 10)
      : NaN;
  if (!Number.isFinite(humorFlavorId)) {
    return NextResponse.json({ success: false, error: 'Invalid humor flavor id' }, { status: 400 });
  }

  /** Paths are under /pipeline per assignment (override segments if needed). */
  const presignPath =
    process.env.ALMOSTCRACKD_PATH_PRESIGN?.trim() || 'pipeline/generate-presigned-url';
  const registerPath =
    process.env.ALMOSTCRACKD_PATH_REGISTER?.trim() || 'pipeline/upload-image-from-url';
  const captionsPath =
    process.env.ALMOSTCRACKD_PATH_CAPTIONS?.trim() || 'pipeline/generate-captions';

  const contentType = file.type || 'image/jpeg';
  const presignBodies = [
    JSON.stringify({ contentType }),
    JSON.stringify({ content_type: contentType }),
  ];

  try {
    let apiBase: string | null = null;
    let lastPresignError = '';
    let presignedPayload: { presignedUrl?: string; cdnUrl?: string } | null = null;

    outer: for (const base of uniqueBases(process.env.ALMOSTCRACKD_API_BASE)) {
      for (const body of presignBodies) {
        const s1 = await fetch(`${base}/${presignPath}`, {
          method: 'POST',
          headers: { ...authHeaders, Accept: 'application/json' },
          body,
        });

        if (s1.ok) {
          try {
            presignedPayload = (await s1.json()) as { presignedUrl?: string; cdnUrl?: string };
          } catch {
            lastPresignError = `${base}/${presignPath} -> invalid JSON body`;
            continue;
          }
          if (presignedPayload.presignedUrl && presignedPayload.cdnUrl) {
            apiBase = base;
            break outer;
          }
          lastPresignError = `${base}/${presignPath} -> 200 but missing presignedUrl/cdnUrl`;
          continue;
        }

        const errText = await s1.text();
        lastPresignError = `${base}/${presignPath} -> ${s1.status} ${errText.slice(0, 280)}`;
        if (s1.status === 400 || s1.status === 422) {
          continue;
        }
        break;
      }
    }

    if (!apiBase || !presignedPayload) {
      const hint405 = lastPresignError.includes('405')
        ? ' Confirm you are using POST …/pipeline/generate-presigned-url with a valid JWT (Authorization: Bearer …).'
        : '';
      return NextResponse.json(
        {
          success: false,
          error: `Presigned URL failed after trying all bases. Last: ${lastPresignError}.${hint405}`,
        },
        { status: 502 }
      );
    }

    const presignedUrl = presignedPayload.presignedUrl;
    const cdnUrl = presignedPayload.cdnUrl;
    if (!presignedUrl || !cdnUrl) {
      return NextResponse.json(
        { success: false, error: 'Invalid presigned payload (missing URLs)' },
        { status: 502 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const put = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: Buffer.from(arrayBuffer),
    });

    if (!put.ok) {
      const errText = await put.text();
      return NextResponse.json(
        { success: false, error: `S3 upload failed: ${put.status} ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const s3 = await fetch(`${apiBase}/${registerPath}`, {
      method: 'POST',
      headers: { ...authHeaders, Accept: 'application/json' },
      body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
    });

    if (!s3.ok) {
      const errText = await s3.text();
      return NextResponse.json(
        { success: false, error: `Register image failed: ${s3.status} ${errText.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const registerPayload = (await s3.json()) as { imageId?: string | number };
    const imageId = registerPayload.imageId;
    if (imageId === undefined || imageId === null) {
      return NextResponse.json(
        { success: false, error: 'Invalid register image response (missing imageId)' },
        { status: 502 }
      );
    }

    const mergedPairs: { id?: string; text: string }[] = [];
    let lastCaptionError = '';

    for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS && mergedPairs.length < CAPTION_TARGET; attempt++) {
      const need = CAPTION_TARGET - mergedPairs.length;
      const s4 = await fetch(`${apiBase}/${captionsPath}`, {
        method: 'POST',
        headers: { ...authHeaders, Accept: 'application/json' },
        body: JSON.stringify(captionRequestBody(need, imageId, humorFlavorId)),
      });

      if (!s4.ok) {
        lastCaptionError = await s4.text();
        break;
      }

      const rawCaptions = await s4.json();
      const batchPairs = parseCaptionPairs(rawCaptions);
      if (batchPairs.length === 0) {
        lastCaptionError = 'Empty caption payload';
        break;
      }

      const take = Math.min(need, batchPairs.length);
      mergedPairs.push(...batchPairs.slice(0, take));

      // If this round returned more DB rows than we need, drop the extras so we never exceed 5 total.
      const idsInBatch = batchPairs.map((p) => p.id).filter((id): id is string => Boolean(id));
      if (idsInBatch.length > take) {
        const idsToDelete = idsInBatch.slice(take);
        await supabase.from('captions').delete().in('id', idsToDelete);
      }
    }

    if (mergedPairs.length === 0 && lastCaptionError) {
      return NextResponse.json(
        {
          success: false,
          error: `Generate captions failed: ${lastCaptionError.slice(0, 280)}`,
        },
        { status: 502 }
      );
    }

    if (mergedPairs.length < CAPTION_TARGET) {
      return NextResponse.json(
        {
          success: false,
          error: `Expected ${CAPTION_TARGET} captions; got ${mergedPairs.length} after up to ${MAX_GENERATE_ATTEMPTS} attempt(s).${
            lastCaptionError ? ` Last: ${lastCaptionError.slice(0, 240)}` : ''
          }`,
        },
        { status: 502 }
      );
    }

    const captions = mergedPairs.slice(0, CAPTION_TARGET).map((p) => p.text);

    return NextResponse.json({
      success: true,
      captions,
      imageUrl: cdnUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
