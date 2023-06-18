import axios from "axios";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

interface ChatMessage {
    role: string;
    content: string;
}

async function generateMessage(history: ChatMessage[]): Promise<ChatMessage> {
    let finalError = null;
    for (let retry = 0; retry < 3; retry++) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo-0613',
                temperature: 1,
                messages: [
                    ...history,
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_KEY}`,
                    'Content-Type': 'application/json',
                }
            });

            if (response.status == 200) {
                let apiResponse = response.data;
                let text = apiResponse.choices[0].message.content;
                return {
                    role: 'assistant',
                    content: text,
                };
            } else {
                finalError = new Error(`OpenAI API returned status code ${response.status}: ${response.statusText}`);
                continue;
            }
        } catch (error) {
            finalError = error;
            continue;
        }
    }
    throw finalError;
}

async function main() {
    let messages: ChatMessage[] = [
        {
            role: 'system',
            content: 'You are a text-based adventure game. You must accept commands from the user and respond with what changed and all that (just like a real text adventure would). For movement, use the compass directions unless you have a very good reason not to.',
        }
    ];

    while (true) {
        let message = await generateMessage(messages);
        console.log(message.content);
        messages.push(message);
        // Read the user's response
        let response = await new Promise<string>((resolve, reject) => {
            process.stdin.once('data', (data) => {
                resolve(data.toString().trim());
            });
        });
        messages.push({
            role: 'user',
            content: response,
        });
    }
}

main();
