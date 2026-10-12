"""Build the standalone quiz: python korean-history-quiz/build.py (stdlib only)."""
from pathlib import Path
import json
import random
import re

ROOT = Path(__file__).resolve().parent
SRC = ROOT / 'src'
sections = json.loads((SRC / 'round1.json').read_text(encoding='utf-8'))
blocks = re.split(r'^@@(\d+)\n', (SRC / 'extra-facts.txt').read_text(encoding='utf-8'), flags=re.M)
assert len(sections) == 20 and len(blocks) == 41

for section in sections:
    sid = section['id']
    assert blocks[sid * 2 - 1] == str(sid)
    rows = [line.split('|') for line in blocks[sid * 2].strip().splitlines()]
    assert len(rows) == 20 and all(len(row) == 2 for row in rows)
    labels = [row[0] for row in rows]
    assert len(set(labels)) == 20
    multiple_choice, blanks = [], []
    for i, (label, sentence) in enumerate(rows):
        matches = re.findall(r'\[([^\]]+)\]', sentence)
        assert len(matches) == 1, (sid, label)
        answers = matches[0].split('/')
        complete = re.sub(r'\[[^\]]+\]', lambda _: answers[0], sentence)
        cloze = re.sub(r'\[[^\]]+\]', '______', sentence)
        # Nearby entries test related details. Keep option order stable on reload.
        group = labels[(i // 4) * 4:(i // 4 + 1) * 4]
        distractors = [item for item in group if item != label]
        random.Random(sid * 100 + i).shuffle(distractors)
        choices = distractors[:]
        choices.insert((sid + i) % 4, label)
        explanation = f'{label}: {complete}'
        multiple_choice.append({
            'type': 'choice', 'q': f'다음 설명에 해당하는 항목을 고르세요.\n“{complete}”',
            'choices': choices, 'answers': [label], 'explanation': explanation,
        })
        blanks.append({
            'type': 'short', 'q': f'[{label}] 빈칸에 들어갈 말을 쓰세요.\n{cloze}',
            'answers': answers, 'explanation': explanation,
        })
    section['rounds'] = [
        {'id': 1, 'title': '기본 개념', 'description': '짧은 답 10 · OX 10',
         'guide': '1–10번은 짧은 답, 11–20번은 OX입니다.', 'questions': section.pop('questions')},
        {'id': 2, 'title': '개념 연결', 'description': '4지선다 20문제',
         'guide': '설명을 읽고 가장 알맞은 항목을 네 개의 보기에서 고르세요.', 'questions': multiple_choice},
        {'id': 3, 'title': '핵심 내용 쓰기', 'description': '빈칸 채우기 20문제',
         'guide': '각 개념의 설명에서 빈칸에 들어갈 인물·용어·연도 등을 쓰세요.', 'questions': blanks},
    ]
    prompts = [q['q'] for r in section['rounds'] for q in r['questions']]
    assert len(prompts) == len(set(prompts)) == 60
    for round_ in section['rounds']:
        assert len(round_['questions']) == 20
        for q in round_['questions']:
            assert q['answers'] and q['explanation']
            if q['type'] == 'choice':
                assert len(set(q['choices'])) == 4
                assert q['choices'].count(q['answers'][0]) == 1

assert sum(len(r['questions']) for s in sections for r in s['rounds']) == 1200
data = json.dumps(sections, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
html = (SRC / 'shell.html').read_text(encoding='utf-8')
for token, value in [('__STYLE__', (SRC / 'style.css').read_text(encoding='utf-8')),
                     ('__DATA__', data), ('__SCRIPT__', (SRC / 'app.js').read_text(encoding='utf-8'))]:
    assert html.count(token) == 1
    html = html.replace(token, value)
(ROOT / 'index.html').write_text(html, encoding='utf-8')
print('Built index.html: 20 sections × 3 rounds × 20 questions = 1,200 questions')
