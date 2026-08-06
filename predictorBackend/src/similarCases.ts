import type { PredictionRequest } from './schema.js'

export type SimilarCase = {
	neutralCitation: string
	title: string
	url: string
}

const dummyCasePool: Array<SimilarCase> = [
	{
		neutralCitation: 'HKSAR v Chan Kwok Ming [2019] HKCFI 1234',
		title: 'HKSAR v Chan Kwok Ming',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2019/1234',
	},
	{
		neutralCitation: 'HKSAR v Wong Wai Shing [2018] HKCFI 987',
		title: 'HKSAR v Wong Wai Shing',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2018/987',
	},
	{
		neutralCitation: 'HKSAR v Lee Ka Ho [2020] HKCFI 456',
		title: 'HKSAR v Lee Ka Ho',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2020/456',
	},
	{
		neutralCitation: 'HKSAR v Cheung Man Kit [2017] HKCFA 32',
		title: 'HKSAR v Cheung Man Kit',
		url: 'https://www.hklii.hk/en/cases/hkcfa/2017/32',
	},
	{
		neutralCitation: 'HKSAR v Tam Siu Fung [2019] HKCFI 2101',
		title: 'HKSAR v Tam Siu Fung',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2019/2101',
	},
	{
		neutralCitation: 'HKSAR v Ng Ho Yin [2021] HKCFI 342',
		title: 'HKSAR v Ng Ho Yin',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2021/342',
	},
	{
		neutralCitation: 'HKSAR v Yip Chun Kit [2018] HKCFI 1502',
		title: 'HKSAR v Yip Chun Kit',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2018/1502',
	},
	{
		neutralCitation: 'HKSAR v Lau Ka Wing [2022] HKCFI 88',
		title: 'HKSAR v Lau Ka Wing',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2022/88',
	},
	{
		neutralCitation: 'HKSAR v Cheng Tsz Long [2020] HKCFI 1734',
		title: 'HKSAR v Cheng Tsz Long',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2020/1734',
	},
	{
		neutralCitation: 'HKSAR v Ho Chun Hin [2017] HKCFI 601',
		title: 'HKSAR v Ho Chun Hin',
		url: 'https://www.hklii.hk/en/cases/hkcfi/2017/601',
	},
]

export function pickSimilarCases(
	_input: PredictionRequest,
): Array<SimilarCase> {
	const count = 4 + Math.floor(Math.random() * 5)
	const pool = [...dummyCasePool]
	for (let index = pool.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(Math.random() * (index + 1))
		;[pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]]
	}
	return pool.slice(0, count)
}
