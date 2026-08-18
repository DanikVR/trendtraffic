# -*- coding: utf-8 -*-
"""
Добавляет строки popup в _locales.

ВАЖНО про способ записи: дописываем ТЕКСТОМ перед закрывающей скобкой, а не через
json.dump. Причина конкретная — в этих файлах записи хранятся компактно, по одной
строке на ключ, и json.dump(indent=2) молча раздувает их в три строки: получается
290 строк косметики на каждую из 52 локалей и нечитаемый дифф, в котором не видно
собственно перевода. Append-only и посимвольная бережность здесь важнее красоты кода.

  python scripts/add-popup-locales.py            # ru + en живым переводом
  python scripts/add-popup-locales.py --stub     # + прочие локали английской заглушкой
"""
import json
import io
import os
import sys

BASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '_locales')

RU = {
    'pop_brand': 'Отправить в блокнот',
    'pop_notebook': 'Блокнот',
    'pop_refreshTitle': 'Обновить список блокнотов (переведёт вкладку NotebookLM на главную)',
    'pop_add': 'Добавить в блокнот',
    'pop_create': 'Создать блокнот',
    'pop_toBulk': 'Массовый импорт →',
    'pop_back': '← Назад',
    'pop_tabLinks': 'Ссылки',
    'pop_tabTabs': 'Вкладки браузера',
    'pop_linksPh': 'По одной ссылке в строке\nhttps://example.com/a\nhttps://example.com/b',
    'pop_selectAll': 'Выбрать все',
    'pop_addBulk': 'Добавить',
    'pop_noNotebooks': 'Список пуст — нажмите ⟳',
    'pop_notImportable': 'Эту страницу добавить нельзя — откройте обычный сайт (http/https).',
    'pop_notImportableNlm': 'Это страница NotebookLM. Откройте статью, которую хотите добавить, и нажмите иконку там.',
    'pop_nlmOffline': 'NotebookLM не открыт',
    'pop_needRefresh': 'Список блокнотов пуст. Нажмите ⟳ — расширение прочитает его в NotebookLM.',
    'pop_refreshing': 'Читаю список блокнотов…',
    'pop_refreshed': 'Список обновлён: ',
    'pop_refreshEmpty': 'Блокнотов не найдено. Войдите в NotebookLM в этом браузере.',
    'pop_refreshFail': 'Не получилось прочитать список.',
    'pop_pickNotebook': 'Сначала выберите блокнот.',
    'pop_adding': 'Добавляю…',
    'pop_addingN': 'Добавляю: ',
    'pop_creating': 'Создаю блокнот…',
    'pop_created': 'Блокнот создан — теперь «Добавить в блокнот».',
    'pop_createFail': 'Не получилось создать блокнот.',
    'pop_untitled': 'Без названия',
    'pop_nothingToAdd': 'Нечего добавлять: нет корректных ссылок.',
    'pop_addFail': 'Не получилось добавить.',
    'pop_added': 'Добавлено в блокнот: ',
    'pop_addedPartial': 'Добавлено: ',
    'pop_addedFailSuf': ', не вышло: ',
    'pop_openNotebook': 'Открыть блокнот',
    'pop_bgBusy': 'идёт генерация — попробуйте после неё',
    'pop_bgListFail': 'не удалось прочитать список',
    'pop_bgNothing': 'нечего добавлять',
    'pop_bgAdding': 'идёт добавление источников — дождитесь конца',
    'pop_needLogin': 'Войдите в NotebookLM — вкладка открыта',
    'pop_skippedBad': 'пропущено строк: ',
    'pop_skippedDup': 'дублей: ',
    'pop_abortedBusy': 'остановлено: началась генерация',
    'pop_abortedFailing': 'остановлено: три ошибки подряд',
    'bg_busyImport': 'Идёт добавление источников — генерация выполнится следом',
    'pop_booster': '⚡ Flow Booster',
    'pop_boosterFail': 'Не удалось открыть пульт. Откройте его кнопкой на странице Google Flow.',
}

EN = {
    'pop_brand': 'Send to notebook',
    'pop_notebook': 'Notebook',
    'pop_refreshTitle': 'Refresh the notebook list (moves the NotebookLM tab to the home page)',
    'pop_add': 'Add to notebook',
    'pop_create': 'Create notebook',
    'pop_toBulk': 'Bulk import →',
    'pop_back': '← Back',
    'pop_tabLinks': 'Links',
    'pop_tabTabs': 'Browser tabs',
    'pop_linksPh': 'One link per line\nhttps://example.com/a\nhttps://example.com/b',
    'pop_selectAll': 'Select all',
    'pop_addBulk': 'Add',
    'pop_noNotebooks': 'Empty list — press the refresh button',
    'pop_notImportable': 'This page cannot be added — open a regular website (http/https).',
    'pop_notImportableNlm': 'This is a NotebookLM page. Open the article you want to add and click the icon there.',
    'pop_nlmOffline': 'NotebookLM is not open',
    'pop_needRefresh': 'The notebook list is empty. Press refresh and the extension will read it from NotebookLM.',
    'pop_refreshing': 'Reading the notebook list…',
    'pop_refreshed': 'List updated: ',
    'pop_refreshEmpty': 'No notebooks found. Sign in to NotebookLM in this browser.',
    'pop_refreshFail': 'Could not read the list.',
    'pop_pickNotebook': 'Choose a notebook first.',
    'pop_adding': 'Adding…',
    'pop_addingN': 'Adding: ',
    'pop_creating': 'Creating a notebook…',
    'pop_created': 'Notebook created — now press “Add to notebook”.',
    'pop_createFail': 'Could not create the notebook.',
    'pop_untitled': 'Untitled',
    'pop_nothingToAdd': 'Nothing to add: no valid links.',
    'pop_addFail': 'Could not add.',
    'pop_added': 'Added to notebook: ',
    'pop_addedPartial': 'Added: ',
    'pop_addedFailSuf': ', failed: ',
    'pop_openNotebook': 'Open notebook',
    'pop_bgBusy': 'a generation is running — try again once it finishes',
    'pop_bgListFail': 'could not read the list',
    'pop_bgNothing': 'nothing to add',
    'pop_bgAdding': 'sources are being added — wait for it to finish',
    'pop_needLogin': 'Sign in to NotebookLM — the tab is open',
    'pop_skippedBad': 'skipped lines: ',
    'pop_skippedDup': 'duplicates: ',
    'pop_abortedBusy': 'stopped: a generation started',
    'pop_abortedFailing': 'stopped: three errors in a row',
    'bg_busyImport': 'Sources are being added — the generation will run next',
    'pop_booster': '⚡ Flow Booster',
    'pop_boosterFail': 'Could not open the panel. Open it with the button on the Google Flow page.',
}


def apply(locale, table):
    """Дописать недостающие ключи, сохранив форматирование файла. Возвращает число добавленных."""
    path = os.path.join(BASE, locale, 'messages.json')
    if not os.path.isfile(path):
        return 0

    raw = io.open(path, encoding='utf-8').read()
    existing = json.loads(raw)                       # заодно валидация: битый файл лучше не трогать
    missing = [(k, v) for k, v in table.items() if k not in existing]
    if not missing:
        return 0

    body = raw.rstrip()
    if not body.endswith('}'):
        raise ValueError('неожиданный хвост файла: ' + path)
    body = body[:-1].rstrip()                        # снимаем закрывающую скобку объекта
    if body.endswith(','):
        body = body[:-1]

    lines = []
    for key, message in missing:
        lines.append('  "%s": { "message": %s }' % (key, json.dumps(message, ensure_ascii=False)))

    out = body + ',\n' + ',\n'.join(lines) + '\n}\n'
    json.loads(out)                                  # не записываем, пока не убедились, что JSON цел
    io.open(path, 'w', encoding='utf-8', newline='\n').write(out)
    return len(missing)


def main():
    total = apply('ru', RU) + apply('en', EN)
    print('ru + en: добавлено ключей', total)

    if '--stub' in sys.argv:
        touched = 0
        for loc in sorted(os.listdir(BASE)):
            if loc in ('ru', 'en'):
                continue
            if apply(loc, EN):                       # английский как заглушка: лучше русского фолбэка из кода
                touched += 1
        print('прочих локалей заполнено английским:', touched)


if __name__ == '__main__':
    main()
