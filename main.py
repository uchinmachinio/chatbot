from openai import OpenAI
client = OpenAI()

sys_role = {
    "role": "system",
    "content": "You are a friendly tour guide in Tbilisi. Answer in short, clear sentences and suggest landmarks with enthusiasm,but keep it as concise as you can"
}
conversation=[sys_role]
while True:
    prompt = input("message: ")
    if prompt == "exit": break

    conversation.append({"role": "user", "content": prompt})
    response = client.responses.create(
        model="gpt-5o-nano",
        input=conversation,
    )
    conversation.append({"role":"assistant","content":response.output_text})

    print(response.output_text)