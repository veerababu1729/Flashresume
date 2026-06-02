import asyncio
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', line_buffering=True)

from llm.master_llm_caller import _RR_POOL_R2, _R2_FLAT, _circuit_tripped

async def main():
    print("Testing call through master_llm_caller logic...")
    preferred_model = "deepseek/deepseek-v4-flash"
    found_match = None
    for provider, m, func in _RR_POOL_R2 + _R2_FLAT:
        if m == preferred_model:
            found_match = (provider, m, func)
            break
            
    if not found_match:
        print("Model not found in pools!")
        return
        
    print(f"Found match: {found_match}")
    print(f"Circuit tripped status: {m in _circuit_tripped}")
    
    provider, m, func = found_match
    print("Calling function...")
    res = await func(m, "Say hello!", 100)
    print("Result:", res)

if __name__ == "__main__":
    asyncio.run(main())
