#!/usr/bin/env python3
"""Loopback-only deterministic OpenAI fixture for UI wiring tests.
Never use its text as evidence of real-model personality acceptance.
No credentials are accepted, stored, or sent anywhere.
"""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST = '127.0.0.1'
PORT = 4176
MODEL = 'luya-ui-fixture'


def reply_for(messages):
    user_messages = [str(item.get('content', '')) for item in messages if item.get('role') == 'user']
    current = user_messages[-1] if user_messages else ''
    if any(phrase in current for phrase in ['先这样', '换个话题', '晚安', '聊到这']):
        return '[UI 测试用模拟回复] 好，这个话题先聊到这里，我们换个话题。'
    listening_mentions = sum(any(word in text for word in ['先听', '说说', '不要建议', '听我讲']) for text in user_messages)
    if any(word in current for word in ['先听', '说说', '不要建议', '听我讲']):
        if listening_mentions >= 2:
            return '[UI 测试用模拟回复] 倾诉时可能你更希望先听你讲，而不是马上分析；也可能只是这次需要这样。我这样理解对吗？'
        return '[UI 测试用模拟回复] 嗯，我先听你说，这次不急着给建议。'
    return '[UI 测试用模拟回复] 收到。这是一条用于检查界面与来源记录的固定回复。'


class FixtureHandler(BaseHTTPRequestHandler):
    server_version = 'LuyaUIFixture/1.0'

    def log_message(self, fmt, *args):
        # Never log request bodies, headers, keys, or user messages.
        print('fixture request: %s' % self.command, flush=True)

    def headers_for(self, status, content_type='application/json; charset=utf-8'):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()

    def send_json(self, payload, status=200):
        self.headers_for(status)
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))

    def do_OPTIONS(self):
        self.headers_for(204)

    def do_GET(self):
        if self.path.rstrip('/') in ['/v1/models', '/models']:
            self.send_json({'object': 'list', 'data': [{'id': MODEL, 'object': 'model', 'owned_by': 'local-ui-fixture'}]})
        elif self.path.rstrip('/') in ['', '/health']:
            self.send_json({'status': 'ok', 'model': MODEL, 'purpose': 'UI tests only; not real-model acceptance'})
        else:
            self.send_json({'error': {'message': 'Fixture route not found'}}, 404)

    def do_POST(self):
        if self.path.rstrip('/') not in ['/v1/chat/completions', '/chat/completions']:
            self.send_json({'error': {'message': 'Fixture route not found'}}, 404)
            return
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 <= size <= 2_000_000:
                raise ValueError('body too large')
            body = json.loads(self.rfile.read(size))
            text = reply_for(body.get('messages', []))
        except (ValueError, TypeError, json.JSONDecodeError):
            self.send_json({'error': {'message': 'Invalid fixture request'}}, 400)
            return
        if body.get('stream'):
            self.headers_for(200, 'text/event-stream; charset=utf-8')
            try:
                for offset in range(0, len(text), 10):
                    chunk = {'id': 'ui-fixture-completion', 'object': 'chat.completion.chunk', 'model': MODEL,
                             'choices': [{'index': 0, 'delta': {'content': text[offset:offset+10]}, 'finish_reason': None}]}
                    self.wfile.write(('data: ' + json.dumps(chunk, ensure_ascii=False) + '\n\n').encode('utf-8'))
                    self.wfile.flush()
                end = {'id': 'ui-fixture-completion', 'object': 'chat.completion.chunk', 'model': MODEL,
                       'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'stop'}]}
                self.wfile.write(('data: ' + json.dumps(end) + '\n\ndata: [DONE]\n\n').encode('utf-8'))
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
        else:
            self.send_json({'id': 'ui-fixture-completion', 'object': 'chat.completion', 'model': MODEL,
                            'choices': [{'index': 0, 'message': {'role': 'assistant', 'content': text}, 'finish_reason': 'stop'}],
                            'usage': {'prompt_tokens': 0, 'completion_tokens': 0, 'total_tokens': 0}})


if __name__ == '__main__':
    print(f'UI fixture only: http://{HOST}:{PORT}/v1 ; model={MODEL}; no external requests', flush=True)
    ThreadingHTTPServer((HOST, PORT), FixtureHandler).serve_forever()
