/**
 * Каталог функций преобразования изображений Quest Flow (Фаза 1 — только изображения).
 *
 * Каждая функция — это «навык» Nano Banana (Gemini image), который владелец вешает на
 * кнопку Telegram-бота через Quest Flow. На входе всегда один и тот же примитив:
 *   промт + N входных картинок (0 — генерация с нуля, 1 — правка, 1+референс — композиция).
 *
 * Базовые промты максимально качественные и уже прописаны. Владелец может дописать своё
 * в поле пресета (questflow_image_presets) — оно склеивается с базовым промтом функции.
 *
 * ВАЖНО про язык: модель НЕ разговаривает с клиентом, она только рисует. Поэтому базовые
 * промты на английском (Nano Banana точнее следует англоязычным инструкциям). Текст,
 * который клиент попросил нанести на картинку, передаётся как есть.
 */

/** Ключ функции (значение выпадающего списка в UI). */
export type ImageFunctionKey =
  | 'generate'
  | 'edit'
  | 'inpaint'
  | 'object_edit'
  | 'compose'
  | 'collage'
  | 'tryon'
  | 'style_transfer'
  | 'branding'
  | 'character'
  | 'iterative'
  | 'text_in_image';

/** Откуда брать «динамическую» входную картинку для функции. */
export type ImageSourceMode = 'client' | 'last_generated' | 'none';

export interface ImageFunctionDef {
  key: ImageFunctionKey;
  /** Подпись в UI (выпадающий список). */
  label: string;
  /** Короткое пояснение для владельца. */
  hint: string;
  /** Нужна ли загрузка референс-картинки (фикс. лого/товар/стиль) у пресета. */
  needsReference: boolean;
  /** Сколько картинок от КЛИЕНТА ожидает функция (0, 1, 2 или больше для коллажа). */
  clientImages: number;
  /** Откуда брать динамическую картинку по умолчанию. */
  defaultSource: ImageSourceMode;
  /** Базовый (системный) промт функции — англ., максимально качественный. */
  basePrompt: string;
  /**
   * Подсказка клиенту по умолчанию (intake) — как бот должен попросить нужные входы.
   * Владелец переопределяет в пресете. На русском (бот ответит на языке клиента сам через QF).
   */
  defaultIntake: string;
}

/**
 * Плейсхолдер в промте, куда подставляется текст запроса клиента (подпись к фото /
 * текст с кнопки). Если плейсхолдера нет — запрос дописывается отдельной строкой.
 */
export const CLIENT_REQUEST_PLACEHOLDER = '{{client_request}}';

export const IMAGE_FUNCTIONS: Record<ImageFunctionKey, ImageFunctionDef> = {
  generate: {
    key: 'generate',
    label: 'Генерация с нуля',
    hint: 'Текст → изображение. Клиент описывает, что нарисовать.',
    needsReference: false,
    clientImages: 0,
    defaultSource: 'none',
    basePrompt:
      'You are a world-class image generation engine. Create a single, high-quality, ' +
      'photorealistic-by-default image from the user request below. Pay close attention ' +
      'to composition, lighting, anatomy and requested details. Do not add watermarks, ' +
      'logos or text unless explicitly requested. User request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Опишите, что нужно нарисовать (как можно подробнее).',
  },
  edit: {
    key: 'edit',
    label: 'Правка изображения',
    hint: 'Клиент присылает фото + что изменить. Общая ретушь/коррекция.',
    needsReference: false,
    clientImages: 1,
    defaultSource: 'client',
    basePrompt:
      'You are an expert photo editor. Edit the PROVIDED image according to the request, ' +
      'preserving everything not mentioned (identity, framing, untouched areas). Keep the ' +
      'result natural and photorealistic, with consistent lighting and perspective. ' +
      'Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Пришлите фото и напишите, что в нём изменить.',
  },
  inpaint: {
    key: 'inpaint',
    label: 'Локальная правка (по тексту)',
    hint: 'Изменить ТОЛЬКО указанную область, остальное не трогать.',
    needsReference: false,
    clientImages: 1,
    defaultSource: 'client',
    basePrompt:
      'You are an expert at precise, localized photo edits. Modify ONLY the region described ' +
      'in the request and leave the rest of the PROVIDED image pixel-identical. Match grain, ' +
      'lighting, color and perspective so the edit is seamless and invisible. ' +
      'Edit instruction: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Пришлите фото и точно укажите, какую область и как изменить.',
  },
  object_edit: {
    key: 'object_edit',
    label: 'Удаление / добавление объекта',
    hint: 'Убрать лишнее или добавить объект на фото клиента.',
    needsReference: false,
    clientImages: 1,
    defaultSource: 'client',
    basePrompt:
      'You are an expert photo retoucher. Add or remove the object(s) specified in the request ' +
      'on the PROVIDED image. When removing, realistically reconstruct the background behind the ' +
      'object. When adding, match scale, perspective, shadows and lighting. Keep everything else ' +
      'unchanged. Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Пришлите фото и напишите, что убрать или что добавить.',
  },
  compose: {
    key: 'compose',
    label: 'Композиция / вставка',
    hint: 'Вставить ваш товар/предмет (референс) в сцену клиента.',
    needsReference: true,
    clientImages: 1,
    defaultSource: 'client',
    basePrompt:
      'You are an expert at photorealistic image composition. The FIRST image is the client scene; ' +
      'every FOLLOWING image is a reference object to insert. Place each reference object naturally ' +
      'into the client scene with correct scale, perspective, contact shadows and lighting so it ' +
      'looks truly present. Preserve each object\'s identity, colors and proportions, and keep the ' +
      'rest of the scene unchanged. Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Пришлите фото места/сцены — мы добавим туда наш предмет.',
  },
  collage: {
    key: 'collage',
    label: 'Коллаж / объединение изображений',
    hint: 'Объединить несколько изображений (клиента и/или референсов) в одну картинку.',
    needsReference: false,
    clientImages: 5,
    defaultSource: 'client',
    basePrompt:
      'You are an expert image compositor. Combine ALL of the provided images into a SINGLE cohesive ' +
      'output as requested — either a clean, well-balanced collage/grid or one seamlessly blended ' +
      'scene. Keep every source subject clearly recognizable, harmonize scale, color and lighting, ' +
      'avoid distortion or cropping out key content, and arrange them with good composition. ' +
      'Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Пришлите несколько изображений (до 5) — объединим их в одну картинку.',
  },
  tryon: {
    key: 'tryon',
    label: 'Виртуальная примерка',
    hint: 'Надеть товар (референс или 2-е фото) на человека с фото клиента.',
    needsReference: true,
    clientImages: 1,
    defaultSource: 'client',
    basePrompt:
      'You are a virtual try-on engine. The FIRST image is the person; the FOLLOWING image(s) are ' +
      'the garment/product. Dress the person in the provided item, preserving the person\'s face, ' +
      'body shape, pose and background EXACTLY. Match the garment\'s pattern, color and texture, ' +
      'with realistic fit, folds and shadows. Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Пришлите своё фото в полный рост — мы покажем вас в этом товаре.',
  },
  style_transfer: {
    key: 'style_transfer',
    label: 'Перенос стиля',
    hint: 'Перерисовать фото клиента (A) в стиле картинки B (референс/2-е фото).',
    needsReference: true,
    clientImages: 1,
    defaultSource: 'client',
    basePrompt:
      'You are a style transfer engine. The FIRST image (A) is the content; the FOLLOWING image (B) ' +
      'defines the target visual style. Re-render the content of image A in the artistic style of ' +
      'image B (palette, brushwork, texture, mood) while keeping the subject, composition and key ' +
      'shapes of A recognizable. Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Пришлите фото, которое нужно стилизовать (мы знаем целевой стиль).',
  },
  branding: {
    key: 'branding',
    label: 'Брендирование',
    hint: 'Добавить ваш логотип/водяной знак (референс) на фото клиента.',
    needsReference: true,
    clientImages: 1,
    defaultSource: 'client',
    basePrompt:
      'You are a brand-asset compositor. The FIRST image is the client photo; the FOLLOWING image ' +
      'is the brand logo/mark. Place the logo cleanly onto the client photo as instructed ' +
      '(default: bottom-right corner, tasteful size, correct opacity), preserving the logo\'s exact ' +
      'colors and proportions and the rest of the photo unchanged. Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Пришлите фото — мы добавим на него наш фирменный знак.',
  },
  character: {
    key: 'character',
    label: 'Консистентность персонажа',
    hint: 'Тот же персонаж (референс-лицо) в новой сцене по запросу.',
    needsReference: true,
    clientImages: 0,
    defaultSource: 'none',
    basePrompt:
      'You are a character-consistent image generator. The PROVIDED reference image(s) define the ' +
      'character\'s identity (face, hair, distinctive features). Generate a new image placing the SAME ' +
      'character into the scene described in the request, keeping the identity unmistakably consistent. ' +
      'Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Опишите сцену — мы поместим туда нашего персонажа.',
  },
  iterative: {
    key: 'iterative',
    label: 'Итеративная правка',
    hint: 'Доработать ПОСЛЕДНЮЮ сгенерированную картинку («ещё синее»).',
    needsReference: false,
    clientImages: 0,
    defaultSource: 'last_generated',
    basePrompt:
      'You are refining a previously generated image (PROVIDED). Apply the requested adjustment ' +
      'while preserving everything else from that image. Make a focused, incremental change. ' +
      'Adjustment: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Напишите, что поправить в последней картинке.',
  },
  text_in_image: {
    key: 'text_in_image',
    label: 'Текст внутри картинки',
    hint: 'Создать баннер/изображение с заданной надписью.',
    needsReference: false,
    clientImages: 0,
    defaultSource: 'none',
    basePrompt:
      'You are a graphic designer that renders crisp, correctly-spelled text inside images. ' +
      'Produce the requested design and render the EXACT text provided, with good typography, ' +
      'kerning and contrast against the background. Do not misspell. Request: ' + CLIENT_REQUEST_PLACEHOLDER,
    defaultIntake: 'Напишите текст надписи и опишите оформление баннера.',
  },
};

/** Список функций для отдачи на фронт (выпадающий список). */
export function listImageFunctions(): Array<{
  key: ImageFunctionKey;
  label: string;
  hint: string;
  needsReference: boolean;
  clientImages: number;
  defaultSource: ImageSourceMode;
  defaultIntake: string;
}> {
  return Object.values(IMAGE_FUNCTIONS).map((f) => ({
    key: f.key,
    label: f.label,
    hint: f.hint,
    needsReference: f.needsReference,
    clientImages: f.clientImages,
    defaultSource: f.defaultSource,
    defaultIntake: f.defaultIntake,
  }));
}

export function isImageFunctionKey(v: unknown): v is ImageFunctionKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(IMAGE_FUNCTIONS, v);
}

/**
 * Склеивает базовый промт функции с дополнением владельца и подставляет запрос клиента.
 * - {{client_request}} в любом из промтов заменяется на текст клиента;
 * - если плейсхолдера нет, а запрос есть — он дописывается отдельной строкой.
 */
export function buildFinalImagePrompt(
  fn: ImageFunctionDef,
  ownerExtra: string,
  clientRequest: string
): string {
  const base = fn.basePrompt || '';
  const extra = (ownerExtra || '').trim();
  let combined = extra ? `${base}\n\nAdditional owner instructions: ${extra}` : base;

  const req = (clientRequest || '').trim();
  if (combined.includes(CLIENT_REQUEST_PLACEHOLDER)) {
    combined = combined.split(CLIENT_REQUEST_PLACEHOLDER).join(req || '(no extra text from the user)');
  } else if (req) {
    combined += `\n\nUser request: ${req}`;
  }
  return combined;
}
