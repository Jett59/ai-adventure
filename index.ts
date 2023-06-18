import axios from "axios";

const OPENAI_KEY = process.env.OPENAI_API_KEY;

interface ChatMessage {
    role: string;
    content?: string;
    function_call?: {
        name: string;
        arguments: any;
    };
}

interface Parameter {
    type: string;
    name: string;
    description: string;
    required: boolean;
}

interface Function {
    name: string;
    description: string;
    parameters: Parameter[];
}

async function generateMessage(history: ChatMessage[], functions: Function[]): Promise<ChatMessage> {
    let finalError = null;
    for (let retry = 0; retry < 3; retry++) {
        try {
            const response = await axios.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-3.5-turbo-0613',
                temperature: 1,
                messages: history.map(message => ({
                    content: message.content ?? null,
                    function_call: message.function_call ? {
                        name: message.function_call.name,
                        arguments: JSON.stringify(message.function_call.arguments),
                    } : undefined,
                    role: message.role,
                })),
                functions: functions.map(functionDescription => ({
                    name: functionDescription.name,
                    description: functionDescription.description,
                    parameters: {
                        type: 'object',
                        properties: functionDescription.parameters.reduce<any>((accumulator, parameter) => {
                            accumulator[parameter.name] = {
                                type: parameter.type,
                                description: parameter.description,
                            };
                            return accumulator;
                        }, {})
                    },
                    required: functionDescription.parameters.filter(parameter => parameter.required).map(parameter => parameter.name),
                }))
            }, {
                headers: {
                    'Authorization': `Bearer ${OPENAI_KEY}`,
                    'Content-Type': 'application/json',
                }
            });

            if (response.status == 200) {
                let apiResponse = response.data;
                if (apiResponse.choices[0].message.function_call) {
                    let function_call = apiResponse.choices[0].message.function_call;
                    let name = function_call.name;
                    let functionArguments = JSON.parse(function_call.arguments);
                    return {
                        role: 'assistant',
                        function_call: {
                            name,
                            arguments: functionArguments,
                        },
                    };
                } else {
                    let text = apiResponse.choices[0].message.content;
                    return {
                        role: 'assistant',
                        content: text,
                    };
                }
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
            content: 'You are a text-based adventure game. Try to act like a real text adventure would whereever possible, but also try to make the user happy if possible.',
        }
    ];

    let inventory: string[] = [];

    const functions: Function[] = [
        {
            name: 'add_inventory',
            description: 'Add an item to the inventory',
            parameters: [
                {
                    type: 'string',
                    name: 'name',
                    description: 'The name of the item',
                    required: true,
                },
            ],
        },
        {
            name: 'remove_inventory',
            description: 'Remove an item from the inventory',
            parameters: [
                {
                    type: 'string',
                    name: 'name',
                    description: 'The name of the item',
                    required: true,
                },
            ],
        },
        {
            name: 'get_inventory',
            description: 'List the contents of the inventory',
            parameters: [],
        },
    ];

    while (true) {
        while (true) {
            let message = await generateMessage(messages, functions);
            messages.push(message);
            if (message.content) {
                console.log(message.content);
                break;
            } else if (message.function_call) {
                switch (message.function_call.name) {
                    case 'add_inventory':
                        console.log(`Gained: ${message.function_call.arguments.name}`);
                        inventory.push(message.function_call.arguments.name);
                        break;
                    case 'remove_inventory':
                        console.log(`Lost: ${message.function_call.arguments.name}`);
                        inventory.splice(inventory.indexOf(message.function_call.arguments.name), 1);
                        break;
                    case 'get_inventory':
                        messages.push({
                            role: 'system',
                            content: inventory.join(', '),
                        });
                        break;
                }
            }
        }

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
