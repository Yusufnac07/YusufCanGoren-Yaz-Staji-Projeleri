"""LLM saglayici katmani. Groq ve Ollama'nin ikisi de OpenAI-uyumlu oldugu icin
TEK SDK (openai) ile, sadece base_url/model degistirerek konusuyoruz.

Cloud  -> Groq   (base: api.groq.com/openai/v1)
Ollama -> yerel  (base: localhost:11434/v1)
"""
from openai import OpenAI
import config


def _client_and_model(model=None):
    if config.PROVIDER == "ollama":
        client = OpenAI(base_url=config.OLLAMA_BASE_URL, api_key="ollama")  # anahtar onemsiz
        return client, (model or config.OLLAMA_LLM_MODEL)
    client = OpenAI(base_url=config.GROQ_BASE_URL, api_key=config.GROQ_API_KEY)
    return client, (model or config.LLM_MODEL)


def chat(messages, model=None, max_tokens=1024, temperature=0.2,
         tools=None, tool_choice=None, response_format=None):
    """Provider-agnostik sohbet. Cagiranlar saglayiciyi bilmez."""
    client, m = _client_and_model(model)
    kwargs = dict(model=m, messages=messages, max_tokens=max_tokens, temperature=temperature)
    if tools:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = tool_choice or "auto"
    if response_format:
        kwargs["response_format"] = response_format
    return client.chat.completions.create(**kwargs)


def chat_stream(messages, model=None, max_tokens=1024, temperature=0.2):
    """Provider-agnostik streaming sohbet: metin parcalarini (delta) yield eder."""
    client, m = _client_and_model(model)
    stream = client.chat.completions.create(
        model=m, messages=messages, max_tokens=max_tokens,
        temperature=temperature, stream=True,
    )
    for chunk in stream:
        if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
