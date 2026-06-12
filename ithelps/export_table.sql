--
-- PostgreSQL database dump
--

\restrict GfCzUagOfZuGI3n4ZyHyR1FfXU00WaNYPGeeiVlf7HeDPxiiPVXL1uZ2SIlobpa

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg13+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg13+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: ithelp_files; Type: TABLE; Schema: public; Owner: dreamstream
--

CREATE TABLE public.ithelp_files (
    id bigint NOT NULL,
    ithelp_id bigint NOT NULL,
    file_path character varying(255) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);


ALTER TABLE public.ithelp_files OWNER TO dreamstream;

--
-- Name: ithelp_files_id_seq; Type: SEQUENCE; Schema: public; Owner: dreamstream
--

CREATE SEQUENCE public.ithelp_files_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ithelp_files_id_seq OWNER TO dreamstream;

--
-- Name: ithelp_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dreamstream
--

ALTER SEQUENCE public.ithelp_files_id_seq OWNED BY public.ithelp_files.id;


--
-- Name: ithelps; Type: TABLE; Schema: public; Owner: dreamstream
--

CREATE TABLE public.ithelps (
    id bigint NOT NULL,
    username character varying(255) NOT NULL,
    description text NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    photo character varying(255),
    status character varying(50) DEFAULT '待處理'::character varying NOT NULL,
    resolution_notes text,
    handler_name character varying(100),
    location character varying(255),
    deleted_at timestamp with time zone,
    is_deleted boolean NOT NULL
);


ALTER TABLE public.ithelps OWNER TO dreamstream;

--
-- Name: ithelps_id_seq; Type: SEQUENCE; Schema: public; Owner: dreamstream
--

CREATE SEQUENCE public.ithelps_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.ithelps_id_seq OWNER TO dreamstream;

--
-- Name: ithelps_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: dreamstream
--

ALTER SEQUENCE public.ithelps_id_seq OWNED BY public.ithelps.id;


--
-- Name: ithelp_files id; Type: DEFAULT; Schema: public; Owner: dreamstream
--

ALTER TABLE ONLY public.ithelp_files ALTER COLUMN id SET DEFAULT nextval('public.ithelp_files_id_seq'::regclass);


--
-- Name: ithelps id; Type: DEFAULT; Schema: public; Owner: dreamstream
--

ALTER TABLE ONLY public.ithelps ALTER COLUMN id SET DEFAULT nextval('public.ithelps_id_seq'::regclass);


--
-- Data for Name: ithelp_files; Type: TABLE DATA; Schema: public; Owner: dreamstream
--

COPY public.ithelp_files (id, ithelp_id, file_path, created_at, updated_at) FROM stdin;
15	14	ithelp-files/rTMLZInSJmFY0ti3X6kfFZLowcANLqF1xEavgWx8.mp4	2025-12-01 09:17:13	2025-12-01 09:17:13
16	14	ithelp-files/BrTaWglukwfW1fTXrTqULjWaot6THmTs899VwcIh.mp4	2025-12-01 09:17:13	2025-12-01 09:17:13
27	7	ithelp_files/FXGzUvV6Z8jKdolH51zLEyMtwSn8J2broEuuBZ4M.jpg	2025-12-01 11:05:32	2025-12-01 11:05:32
30	8	ithelp_files/CgnMswBaM13Hnek5gYcxHXg2jLVauRPErVQBDkly.mp4	2025-12-01 11:17:19	2025-12-01 11:17:19
35	20	ithelp-files/iTCm43r9j7udd58ZNd7diwXcJAjxzwWNcxewCpzM.jpg	2025-12-01 11:24:30	2025-12-01 11:24:30
37	21	ithelp-files/R3evXiy29OTPs6zseBoM1iyQseNvBHXbzFiIlVIC.jpg	2025-12-01 16:11:09	2025-12-01 16:11:09
41	23	ithelp-files/ObzNg5pSlEnnZKKcH3p2P4U9wrBiyPoJQdAyIx6R.jpg	2025-12-03 09:13:02	2025-12-03 09:13:02
45	25	ithelp-files/ZTUtaLoHQVv7EVwSGLQPM6Oneplas8HrNldb9ecg.jpg	2025-12-03 10:28:04	2025-12-03 10:28:04
46	25	ithelp-files/EI6WZibJIiUZygqiMc1AVDKDsxTlzTBvtW4P01Si.jpg	2025-12-03 10:28:04	2025-12-03 10:28:04
47	28	ithelp-files/09TnKoRPbSJZeHiGy1Ih3Nw5ma39IXXYfFWVSif0.jpg	2025-12-08 11:37:11	2025-12-08 11:37:11
48	29	ithelp-files/5UMfX9UzSt5WkKR4t73PPWbrxJn2RKPrrUMPW2bx.jpg	2025-12-08 15:10:28	2025-12-08 15:10:28
50	30	ithelp-files/77z5JcSCYkK5x70Abpc20qeDeXjNGusuouSIsfZ4.jpg	2025-12-10 12:33:13	2025-12-10 12:33:13
54	30	ithelp-files/kOPamUukCMrqiXxPecqGe97a5e6ESTdLojOpzRgy.jpg	2025-12-13 08:38:51	2025-12-13 08:38:51
55	37	ithelp-files/39QNeWqcuqjdzAvgjtdVPNqwxSjtUqq49YN8AhxR.jpg	2025-12-14 11:39:28	2025-12-14 11:39:28
56	39	ithelp-files/pVgDfdqkEAJpTv0z5G0sqKJ0HWcaFIN7rXIhqBAY.jpg	2025-12-15 10:25:29	2025-12-15 10:25:29
57	40	ithelp-files/ZNhDLBlcikTOinaSodKFDVukV5JsNAvgXLTIlnH8.jpg	2025-12-15 10:30:07	2025-12-15 10:30:07
58	41	ithelp-files/YRaBmK9ViRmUSH5EnOkD7HzpffqXPv6V26b6iQP0.jpg	2025-12-15 10:32:08	2025-12-15 10:32:08
64	47	ithelp-files/PAF6MWkOkNV7URmk9W41RoBl1WJFiwbWYbXc9MMM.jpg	2025-12-17 17:25:46	2025-12-17 17:25:46
65	48	ithelp-files/8TFbQ41hK96WfBVGVT2nQDgNTkFK2KgIlbC1XKG4.jpg	2025-12-18 13:46:43	2025-12-18 13:46:43
66	49	ithelp-files/P7vfi6eK3JJdlQO1vYFOjI4v5Re5lbMruMfOess9.jpg	2025-12-19 10:32:24	2025-12-19 10:32:24
67	49	ithelp-files/CkyGLx5j3tRTv7rZalkNDHFx7fsq9NsyTiQlJd8k.jpg	2025-12-19 10:34:59	2025-12-19 10:34:59
68	50	ithelp-files/OxeMF3jVd7DwfUooRC7LzI2nmTyz6tbYjDp3f0Jg.jpg	2025-12-22 17:10:08	2025-12-22 17:10:08
69	51	ithelp-files/erKVvRPYtvcuY9NufN1mn9JGr4xE0FFGnoxKHhGY.jpg	2025-12-22 17:14:24	2025-12-22 17:14:24
72	47	ithelp-files/uyhbE0KtUN3Ko9Nxf4q3IfBQw5Q8DE1xRYzZ2auh.jpg	2025-12-22 17:15:59	2025-12-22 17:15:59
73	47	ithelp-files/Gx4ZXZQ2uia0S23zV81Vl6bnAB5N888Rx3a5cceJ.jpg	2025-12-22 17:15:59	2025-12-22 17:15:59
75	54	ithelp-files/oIo17f7UzCZhvcilFSxoiYRyRhZWREndrKDOrfGI.jpg	2025-12-26 11:33:43	2025-12-26 11:33:43
76	54	ithelp-files/K46dPpMJaJuANRbVBr1vlp9UQDezazOyz4kh9gTa.jpg	2025-12-26 11:33:43	2025-12-26 11:33:43
77	55	ithelp-files/Q1jlzV3lF3e4kiXqxaVywvy1eehTEyaFIWvcSFmw.mp4	2025-12-26 11:38:13	2025-12-26 11:38:13
78	57	ithelp-files/i6HTMk4lbL6Z5ZPPD4DaSYL8scuqaJizJTwJfZoj.jpg	2025-12-26 14:32:43	2025-12-26 14:32:43
79	57	ithelp-files/to6LZxcahvqm48std6UaWBqZIE4kE95LT9J7iUxf.jpg	2025-12-26 14:32:43	2025-12-26 14:32:43
80	60	ithelp-files/7nnqoJ4ABnseTc8cm3h4VeO3QIGT9CSIoR8wrky7.jpg	2025-12-30 08:42:57	2025-12-30 08:42:57
82	61	ithelp-files/KYVJjiFrhPzjMcPsuoAGBilS7iAW7QM5eiOsh82E.jpg	2026-01-01 19:16:14	2026-01-01 19:16:14
83	62	ithelp-files/9F4BlIUaQu7nQTD0NcxGT9FDVQ74G24Ii3WVHSzV.jpg	2026-01-02 11:19:10	2026-01-02 11:19:10
85	64	ithelp-files/t4TMjfkMmRKkSEH2oU1nJ22gjqKaLI2Cgqz4bqkw.jpg	2026-01-07 08:33:05	2026-01-07 08:33:05
109	83	ithelp-files/193724.jpg	2026-01-09 07:11:49	2026-01-09 07:11:49
112	86	ithelp-files/20260112.JPG	2026-01-12 00:30:00	2026-01-12 00:30:00
113	87	ithelp-files/螢幕擷取畫面_2025-12-06_110746_TTkz5TR.png	2026-01-12 01:29:04	2026-01-12 01:29:04
114	90	ithelp-files/194370.jpg	2026-01-14 08:21:32	2026-01-14 08:21:32
115	92	ithelp-files/螢幕擷取畫面_2025-12-06_110746_mu5stQO.png	2026-01-15 00:57:41	2026-01-15 00:57:41
116	93	ithelp-files/194301.jpg	2026-01-15 01:14:24	2026-01-15 01:14:24
117	94	ithelp-files/194647.jpg	2026-01-16 01:46:20	2026-01-16 01:46:20
118	95	ithelp-files/194796.jpg	2026-01-17 02:33:13	2026-01-17 02:33:13
119	96	ithelp-files/195167_0.jpg	2026-01-21 00:10:45	2026-01-21 00:10:45
120	96	ithelp-files/195168_0.jpg	2026-01-21 00:10:45	2026-01-21 00:10:45
121	120	ithelp-files/螢幕快照_2026-01-21_下午3.46.46.png	2026-01-21 15:50:25	2026-01-21 15:50:25
122	121	ithelp-files/195236_0.jpg	2026-01-21 15:58:22	2026-01-21 15:58:22
123	121	ithelp-files/195237_0.jpg	2026-01-21 15:58:22	2026-01-21 15:58:22
124	121	ithelp-files/195238_0.jpg	2026-01-21 15:58:22	2026-01-21 15:58:22
125	121	ithelp-files/195239_0.jpg	2026-01-21 15:58:22	2026-01-21 15:58:22
126	121	ithelp-files/195240_0.jpg	2026-01-21 15:58:22	2026-01-21 15:58:22
127	121	ithelp-files/195241_0.jpg	2026-01-21 15:58:22	2026-01-21 15:58:22
128	121	ithelp-files/195242_0.jpg	2026-01-21 15:58:22	2026-01-21 15:58:22
129	128	ithelp-files/196918.jpg	2026-02-08 08:10:54	2026-02-08 08:10:54
130	134	ithelp-files/198116.jpg	2026-02-23 15:12:18	2026-02-23 15:12:18
131	134	ithelp-files/198117.jpg	2026-02-23 15:12:18	2026-02-23 15:12:18
132	137	ithelp-files/202427.jpg	2026-03-01 10:51:57	2026-03-01 10:51:57
133	137	ithelp-files/198545.jpg	2026-03-01 10:52:34	2026-03-01 10:52:34
134	142	ithelp-files/199181.jpg	2026-03-08 09:36:36	2026-03-08 09:36:36
135	143	ithelp-files/199441.jpg	2026-03-10 18:07:52	2026-03-10 18:07:52
139	148	ithelp-files/200247.jpg	2026-03-17 18:34:53	2026-03-17 18:34:53
140	148	ithelp-files/196309.jpg	2026-03-17 18:38:24	2026-03-17 18:38:24
141	147	ithelp-files/200185.jpg	2026-03-17 18:39:52	2026-03-17 18:39:52
142	146	ithelp-files/199823.jpg	2026-03-17 18:40:21	2026-03-17 18:40:21
143	146	ithelp-files/S__6299702.jpg	2026-03-17 18:40:21	2026-03-17 18:40:21
144	151	ithelp-files/200321.jpg	2026-03-18 10:32:49	2026-03-18 10:32:49
145	153	ithelp-files/200783.jpg	2026-03-22 11:17:53	2026-03-22 11:17:53
146	157	ithelp-files/91a3921f-bae4-4a0a-b035-cf58fb15a9e7.mp4	2026-03-30 12:38:18	2026-03-30 12:38:18
147	158	ithelp-files/201581.jpg	2026-03-30 12:40:27	2026-03-30 12:40:27
148	162	ithelp-files/LINE_MOVIE_1775633332631.mp4	2026-04-08 15:32:22	2026-04-08 15:32:22
149	163	ithelp-files/螢幕擷取畫面_2025-12-31_160729.png	2026-04-11 23:37:45	2026-04-11 23:37:45
150	163	ithelp-files/friday.jpg	2026-04-11 23:41:18	2026-04-11 23:41:18
151	165	ithelp-files/203536.jpg	2026-04-13 09:09:52	2026-04-13 09:09:52
152	161	ithelp-files/螢幕擷取畫面_2026-04-15_080918.png	2026-04-15 02:18:13	2026-04-15 02:18:13
153	166	ithelp-files/1776385148599.jpg	2026-04-17 00:19:49	2026-04-17 00:19:49
154	167	ithelp-files/204118.jpg	2026-04-20 07:16:20	2026-04-20 07:16:20
155	170	ithelp-files/image-1777082872785.jpg	2026-04-25 02:40:48	2026-04-25 02:40:48
156	171	ithelp-files/image-1777020023682.jpg	2026-04-25 02:44:01	2026-04-25 02:44:01
157	172	ithelp-files/204533_0.jpg	2026-04-25 04:38:29	2026-04-25 04:38:29
158	172	ithelp-files/204534_0.jpg	2026-04-25 04:38:29	2026-04-25 04:38:29
159	172	ithelp-files/204535_0.jpg	2026-04-25 04:38:29	2026-04-25 04:38:29
160	173	ithelp-files/17773476781421.jpg	2026-04-29 02:51:01	2026-04-29 02:51:01
\.


--
-- Data for Name: ithelps; Type: TABLE DATA; Schema: public; Owner: dreamstream
--

COPY public.ithelps (id, username, description, created_at, updated_at, photo, status, resolution_notes, handler_name, location, deleted_at, is_deleted) FROM stdin;
30	許恒裕	請問教會帳號找不到可以刪除Gemini對話記錄的選項？請問可以從哪刪除用不到的對話？	2025-12-10 12:33:13	2025-12-10 14:41:04	\N	已完成	問過廠商, 回覆如下:\r\n@breadoflife.taipei 的帳號是企業帳號 由台北靈糧堂管理\r\nGoogle 對企業帳號運作方式不同於個人帳號\r\n不能刪除對話便於稽核,也是合理	楊主恩	靈糧神學院	\N	f
2	柯婉儀	更換紅色墨水夾!	2025-11-24 08:59:03	2025-11-24 09:06:27	\N	待處理	\N	\N	\N	\N	f
3	區牧師	時鐘停住	2025-11-24 17:10:23	2025-11-24 17:10:23	\N	待處理	\N	\N	\N	\N	f
28	廖學敏	印表機無黑色墨水	2025-12-08 11:37:11	2025-12-10 14:43:32	\N	已完成	\N	謝侑均	宣教四樓禱告中心	\N	f
4	區師母	電話不通!!!	2025-11-24 17:20:44	2025-11-26 09:01:30	\N	待處理	\N	\N	\N	\N	f
5	misadmin	時鐘停住	2025-11-26 09:52:09	2025-11-26 09:52:09	/tmp/phpQ3jY9I	待處理	\N	\N	\N	\N	f
7	陳顗宓	英語牧區幹事的PC風扇不運轉導致網速很慢，下圖是張先生在她位子測速的結果，可能可以幫她換一台PC看看	2025-11-27 14:14:48	2025-11-27 14:19:17	ithelp-photos/oiPfsatkpVXBVOZ8FEvPp5SwHpNlhCievdxWnqGD.jpg	待處理	\N	\N	\N	\N	f
24	劉家如	安裝簡映軟體	2025-12-03 09:54:27	2025-12-03 09:54:27	\N	待處理	\N	\N	\N	\N	f
25	林昶佑	交接門禁系統,檢視可進出門	2025-12-03 10:28:04	2025-12-03 10:28:04	\N	待處理	\N	\N	\N	\N	f
31	温國勛	淡水福音中心獨立後的Gmail,共用雲端硬碟移轉	2025-12-10 14:27:24	2025-12-10 15:10:59	\N	待處理	1.申請新的 Google Workspace 服務 ,一個帳號也能申請\r\n2建立新帳號\r\n3遷移信件/檔案...等, 將所有資料複製過去\r\n4確認轉移完成後, 在舊後台移除所有舊帳號/群組, 以及釋出網域	楊主恩	淡水福音中心	\N	f
29	淡水思宇	在資訊方面想請教一下 網址、email、雲端空間 想問問有沒有總部的相關的資料可以參考（包含費用等等	2025-12-08 15:10:28	2025-12-10 09:12:20	\N	待處理	20201212周五晨禱見面詳談	楊主恩	\N	\N	f
20	林志琅	倉庫無法列印	2025-12-01 11:24:30	2025-12-10 09:26:29	\N	已完成	10.10.51.228設定固定ip	成威進	\N	\N	f
26	彩月	無法印表	2025-12-04 16:15:04	2025-12-10 12:20:49	\N	已完成	印表機設固定ip 10.10.51.228即可	楊主恩	\N	\N	f
35	謝文華	更新防毒軟體	2025-12-11 16:07:17	2025-12-11 16:07:55	\N	待處理		楊主恩	靈糧神學院	\N	f
37	蔡欣宜	電腦的聲音無法接出來	2025-12-14 11:38:24	2025-12-14 11:39:28	\N	已完成	如圖,選擇喇吧聲音就出來了	楊主恩	三樓兒主	\N	f
39	李怡佩 8525	PDF無法多文件列印	2025-12-15 10:25:29	2025-12-15 10:27:46	\N	已完成	請選擇進階選項,如圖,即可看見列印選項進行列印	楊主恩	宣教11F	\N	f
40	李學瀚	把 hansli112@yahoo.com.tw 加到 台北靈糧堂竹圍福音中心 <zhuwei.br@breadoflife.taipei>	2025-12-15 10:30:07	2025-12-15 10:30:32	\N	已完成	OK	楊主恩	竹圍福音中心	\N	f
41	李文惠	電腦無法放出聲音	2025-12-15 10:32:08	2025-12-15 10:33:17	\N	已完成	把音源線插回綠色孔即可,如圖	楊主恩	愛鄰樓3樓控台 8008	\N	f
49	陳曉平8771	電腦二播喬老師的ppt會出現這個mac的Menu bar,如圖	2025-12-19 10:32:24	2025-12-19 10:35:11	\N	已完成	MAC\\系統設定\\桌面及docker\\選擇 "僅限全螢幕",如圖即可	楊主恩	宣教控台	\N	f
47	陳源湘	安裝Mac mini立式支架,並貼電源標籤	2025-12-17 17:22:16	2025-12-22 17:15:59	\N	已完成		楊主恩	山莊副室室	\N	f
21	閻力行	安裝11F印表機以利裝訂	2025-12-01 16:11:09	2025-12-19 10:38:37	\N	已完成	安裝11F印表機	楊主恩	\N	\N	f
43	蕭羿滋	急件！平安  李哥的電腦完全沒反應！  請協助	2025-12-15 12:22:43	2025-12-15 12:26:42	\N	已完成	anydesk+msconfig	楊主恩	宣教11F	\N	f
23	尤霞仁	同工專屬密碼進不去	2025-12-03 09:13:02	2025-12-19 10:40:05	\N	已完成	重設密碼即可	楊主恩	\N	\N	f
14	成威進	愛鄰樓五樓會議室C面板切換矩陣後無法投影，A面板正常，再麻煩您幫忙檢修，謝謝。	2025-12-01 09:17:13	2025-12-19 10:40:40	\N	待處理		楊主恩	\N	\N	f
46	陳源湘	明天（2025/12/17）下午2：00，請和行政部一同前往北區會堂，協助電腦投影設備相關的問題處理，謝謝。	2025-12-17 09:10:17	2025-12-17 17:20:30	\N	已完成	繳回一台筆電	楊主恩	北區會堂	\N	f
57	蔡享諭	有人方便幫我開愛鄰4樓的2台NAS嗎？  或是給我 10.20.220.218 10.20.220.216 的MAC Address  我忘記紀錄 若有我可以WOL叫醒兩台	2025-12-26 14:32:43	2025-12-26 14:33:42	\N	已完成	去愛鄰4樓開機即可	楊主恩	愛鄰4樓	\N	f
1	洪儀芬	滑鼠的cursor不見!!	2025-11-24 08:52:32	2025-12-19 10:41:22	\N	已完成	更換滑鼠即可	楊主恩	\N	\N	f
48	陳佩容 8455	Epson 680點陣印表機無法列印	2025-12-18 13:31:36	2025-12-18 13:47:39	\N	已完成	選回USB printer port 即可	楊主恩	宣教11F	\N	f
8	博仁	說2樓控台的電腦有狀況需要協助	2025-11-27 15:53:23	2025-12-19 10:43:44	ithelp-photos/hE0Av3bP06LKS1eAD8VdHIn1B4O178MznkYgX4KX.mp4	已完成	螢幕閃動很厲害,重新開機觀察中	楊主恩	\N	\N	f
50	溫政芬	控台桌面螢幕無畫面	2025-12-22 17:10:07	2025-12-22 17:10:49	\N	已完成	電腦重開機即可	楊主恩	宣教13樓	\N	f
51	青崇小花	電腦顯示慢,建議加裝顯卡來加速顯示	2025-12-22 17:14:24	2025-12-22 17:14:24	\N	待處理	\N	\N	山莊導播室	\N	f
54	成威進	四樓副堂電腦一開機後畫面	2025-12-26 11:08:07	2025-12-26 11:34:00	\N	已完成	重開機即可	楊主恩	宣教四樓	\N	f
55	蔡元正	今天我補休，可否請你幫我開四樓禱告殿的晨禱轉播	2025-12-26 11:38:13	2025-12-26 11:39:04	\N	已完成	透過youtube收看即可	楊主恩	四樓禱告殿	\N	f
56	陳曉平 8771	控台電腦一propresenter未同步	2025-12-26 11:40:32	2025-12-26 11:41:05	\N	已完成	重開機即同步完成	楊主恩	宣教二樓	\N	f
58	樊家琪	iphone手機無法投影	2025-12-29 08:43:24	2025-12-29 08:44:41	\N	已完成	重開大通投影設備並切換至HDMI2即可	楊主恩	山莊105教室	\N	f
59	劉慧怡	監視系統回放教學	2025-12-29 08:46:28	2025-12-29 08:46:49	\N	已完成		楊主恩	山莊行政中心	\N	f
60	謝院長	搖控筆無法遙控控台電腦三	2025-12-30 08:42:57	2025-12-30 08:44:46	\N	已完成	將電腦三取消不需要開機的軟體	楊主恩	山莊大堂	\N	f
61	柯凱中	文山婦女中心7台還原出廠值交還社會局	2026-01-01 19:16:14	2026-01-01 19:17:53	\N	已完成	使用系統重設5台電腦,重灌2台電腦即可	楊主恩 謝侑均	文山婦女中心	\N	f
62	吳宏琪	大堂面對舞台左手邊最前面的電視 請把下垂的線路收好固定	2026-01-02 11:19:10	2026-01-02 11:19:41	\N	已完成	將下垂的線路用束帶綁好了，謝謝	楊主恩	宣教大堂	\N	f
63	閻力行 7506	eset防毒授權過期	2026-01-05 16:28:31	2026-01-05 16:29:30	\N	已完成	重裝agent 並派送授權工作即可	楊主恩	山莊生培	\N	f
64	廖學敏 8775	prayer的profile =>Mac顯示器有兩個同步顯示,沒有延伸桌面並按順序排列好,以利propresenter顯示	2026-01-07 08:33:05	2026-01-07 08:34:25	\N	已完成	對同步的顯示器按右鍵/取消同步顯示即可	楊主恩	宣教二樓控台電腦二	\N	f
65	柯凱中 8718	無法使用自然人憑證	2026-01-07 13:57:05	2026-01-07 13:57:47	\N	已完成	安裝自然人憑證軟體即可	楊主恩	宣教五樓	\N	f
113	misadmin	ss	2026-01-21 01:45:17	2026-01-21 01:45:17	\N	待處理		\N	宣教11樓	2026-01-21 02:15:33.112164+00	t
91	test vscode django format	test vscode django format	2026-01-14 16:54:37	2026-01-14 16:54:37	\N	待處理		\N	test vscode django format	2026-01-15 01:10:43.834394+00	t
92	test vscode django format relist	test vscode django format	2026-01-14 00:57:41	2026-01-14 00:57:41	\N	已完成	ok	楊主恩	test vscode django format	2026-01-15 01:10:47.614216+00	t
93	張先生jacky	山莊活水廳門禁失效	2026-01-14 17:14:24	2026-01-14 17:14:24	\N	已完成	ok	張先生	山莊活水廳	\N	f
94	吳宏祺	山莊行政辦公室外的電腦是公共電腦，很多人使用，剛剛發現防毒軟體需要更新，再請安排，謝謝！	2026-01-15 17:46:20	2026-01-15 17:46:20	\N	已完成	安裝eset防毒軟體即可	楊主恩	山莊行政辦公室	\N	f
95	樊家琪	電視無訊號	2026-01-16 18:31:30	2026-01-16 18:31:30	\N	已完成	重插HDMI線即可	楊主恩	山莊B2走道	\N	f
96	謝侑均	電腦三防毒軟體授權失效	2026-01-20 16:10:45	2026-01-20 16:10:45	\N	已完成	https://eba.eset.com 安裝雲端agent與防毒軟體	楊主恩	山莊B1控台	\N	f
97	test	test	2026-01-20 16:15:03	2026-01-20 16:15:03	\N	待處理		\N	test	2026-01-21 00:15:24.287667+00	t
83	陳信安 8368	主恩哥我想要跟你約個時間整理一下創意處雲端的權限	2026-01-08 23:11:49	2026-01-08 23:11:49	\N	已完成		楊主恩	宣教11樓	\N	f
84	林淑眞	源湘哥平安！ 謝謝您們協助淑眞傳道安裝好電腦， 因事工需求，目前她需進到G槽共用一些資料， 請協助開通G槽內的以下資料夾使用權限(圖示如附件)：  1.P-2220-台語 2.敬拜中心-主日崇拜檔案 3.O-86-義工專用暫存區 4.t-台語主日暫存(\\\\10.20.220.230)(T:)  感恩，謝謝！	2026-01-08 23:30:52	2026-01-08 23:30:52	\N	已完成	karen.hung@breadoflife.taipei     Nas10.20.220.230 id:karen.hung pass:LLC123abc	楊主恩	宣教六樓	\N	f
85	徐麗媛 8252	Gmail聯絡人匯出給林淑眞傳道	2026-01-08 23:32:04	2026-01-08 23:32:04	\N	已完成		楊主恩	宣教六樓	\N	f
86	周雨萱	主恩哥平安，青年牧區幹事來信需要我們協助設定(山莊事務機)http://10.2.15.233/，需要請你抽空協助設定了	2026-01-11 16:30:00	2026-01-11 16:30:00	\N	已完成	http://10.2.15.233/新增電話簿即可	楊主恩	山莊行政部事務機	\N	f
98	ttt	tttt	2026-01-20 16:16:03	2026-01-20 16:16:03	\N	待處理		\N	ttt	2026-01-21 00:16:10.294373+00	t
87	test	test	2026-01-11 01:29:04	2026-01-11 01:29:04	\N	待處理		\N	test	2026-01-12 01:30:26.48978+00	t
89	test del	test  del	2026-01-11 19:55:31	2026-01-11 19:55:31	\N	待處理		\N	test  del	2026-01-12 03:55:34.739006+00	t
88	行政部	wify BOL_CAST無法連接	2026-01-11 11:27:21	2026-01-11 11:27:21	\N	已完成	連接PX大通的private lan 即可投影	楊主恩	山莊迦南美地	\N	f
90	成威進	資訊部筆電防毒軟體授權失效	2026-01-14 00:20:47	2026-01-14 00:20:47	\N	已完成	安裝雲端agent，並由中控派送產品啓用的工作即可	楊主恩	山莊資訊室	\N	f
112	aaa	aaaa	2026-01-21 01:25:23	2026-01-21 01:25:23	\N	待處理		\N	aaaa	2026-01-21 02:15:36.004329+00	t
99	dsfdsf	sdfdsfds	2026-01-20 16:16:50	2026-01-20 16:16:50	\N	待處理		\N	sdfsdf	2026-01-21 00:16:57.2147+00	t
100	test	test	2026-01-20 16:21:55	2026-01-20 16:21:55	\N	待處理		\N	test	2026-01-21 00:36:33.400519+00	t
101	yyyy	yyyy	2026-01-20 16:36:41	2026-01-20 16:36:41	\N	待處理		\N	yyy	2026-01-21 00:38:17.539884+00	t
118	uuu	uuuu	2026-01-21 10:14:06	2026-01-21 10:14:06	\N	待處理		\N	uuuu	2026-01-21 02:15:21.729556+00	t
117	hhh	hhhh	2026-01-21 02:13:19	2026-01-21 02:13:19	\N	待處理		\N	hhh	2026-01-21 02:15:24.062556+00	t
116	vvv	vvvv	2026-01-21 02:11:31	2026-01-21 02:11:31	\N	待處理		\N	vvv	2026-01-21 02:15:26.391532+00	t
115	eee	eeee	2026-01-21 02:07:34	2026-01-21 02:07:34	\N	待處理		\N	eee	2026-01-21 02:15:28.829892+00	t
114	misadmin	yyy	2026-01-21 01:46:06	2026-01-21 01:46:06	\N	待處理		\N	yy	2026-01-21 02:15:30.938534+00	t
111	mmm	mmmm	2026-01-21 01:23:14	2026-01-21 01:23:14	\N	待處理		\N	mmm	2026-01-21 02:15:38.166339+00	t
110	lll	llll	2026-01-21 01:22:49	2026-01-21 01:22:49	\N	待處理		\N	lll	2026-01-21 02:15:40.83884+00	t
109	kkk	kkk	2026-01-21 01:15:16	2026-01-21 01:15:16	\N	待處理		\N	kk	2026-01-21 02:15:42.987373+00	t
108	hh	hh	2026-01-21 01:13:17	2026-01-21 01:13:17	\N	待處理		\N	hh	2026-01-21 02:15:45.423224+00	t
107	888	8888	2026-01-21 01:00:51	2026-01-21 01:00:51	\N	待處理		\N	888	2026-01-21 02:15:47.750209+00	t
106	7777	77777	2026-01-21 00:59:37	2026-01-21 00:59:37	\N	待處理		\N	7777	2026-01-21 02:15:49.857992+00	t
105	dfgfdg	fdgfdgd	2026-01-21 00:54:23	2026-01-21 00:54:23	\N	待處理		\N	dfgfdg	2026-01-21 02:15:51.963641+00	t
104	fgfdg	dfgfdg	2026-01-21 00:50:38	2026-01-21 00:50:38	\N	待處理		\N	dfgfdg	2026-01-21 02:15:54.027753+00	t
103	bbb	bbbb	2026-01-21 00:47:47	2026-01-21 00:47:47	\N	待處理		\N	bbb	2026-01-21 02:15:56.413519+00	t
102	iii	iii	2026-01-21 00:38:28	2026-01-21 00:38:28	\N	待處理		\N	iii	2026-01-21 02:15:58.841007+00	t
119	鄭永德	Gmail中的T8系統無法審核	2026-01-21 10:17:24	2026-01-21 10:17:24	\N	已完成	教育訓練先登入T8,然後再點擊Gmail的link即可	楊主恩	宣教五樓	\N	f
120	蔡翔麗 9358	還原雙園雲端共用硬碟 P_2A11_雙園福音中心	2026-01-21 15:50:25	2026-01-21 15:50:25	\N	待處理		\N	古亭福音中心	\N	f
121	陳曉平 8771	夢串流系統設計	2026-01-21 15:58:22	2026-01-21 15:58:22	\N	待處理		\N	宣教四樓	\N	f
122	陳璽文 8249	安裝10.10.5.33印表機 位址:249  id:8249    pass:8249	2026-01-26 12:00:41	2026-01-26 12:00:41	\N	已完成	ok	楊主恩	宣教四樓	\N	f
123	錢玉芬	資訊部同工們平安，\r\n我是錢玉芬老師，目前經常使用私人的信箱帳號 ( chienyufen77@gmail.com ) ，而教會的信箱(yufen.chien@breadoflife.taipei)我較少使用，也忘記密碼，因此經常無法收到教會的信件，不知道能否請人幫忙協助我設定轉寄教會信件至私人信件呢?\r\n\r\n                                                     同工 錢玉芬 請託	2026-01-28 14:56:30	2026-01-28 14:56:30	\N	已完成	教會的信箱(yufen.chien@breadoflife.taipei) 停用,私人的信箱帳號 ( chienyufen77@gmail.com )加入AAAA全體同工aaaaallstaff@breadoflife.taipei	楊主恩	靈糧神學院	\N	f
124	許恒裕 6412	主恩平安：\r\n我的電腦無法更新防毒軟體，\r\n有勞主恩協助	2026-01-28 16:46:41	2026-01-28 16:46:41	\N	已完成	ESET PROTECT_61.216.129.205先保留給許恒裕報到即可	楊主恩	靈糧神學院	\N	f
125	羅翔駿 8456	安裝連台系統10.20.220.34/data1/   id:misadmin   pass:Mis77452323@	2026-01-29 14:12:57	2026-01-29 14:12:57	\N	已完成	ok	楊主恩	宣教11樓	\N	f
126	黃湧信	更新防毒軟體,並啟用win11授權	2026-01-30 17:16:07	2026-01-30 17:16:07	\N	已完成	ok	楊主恩	宣教11樓	\N	f
127	侯任祐	資訊部您好\r\n\r\n今年度宣植在規劃新的宣教點資訊彙整、搜集的方式\r\n為確保長期資訊的穩定性，且不被個人人事流動影響\r\n我們想要申請一個部門公用的email帳號（可用帳密登入），以及與其對應的google雲端空間\r\n\r\n詳細申請的進行方式，懇請協助告知！謝謝！	2026-02-05 16:14:41	2026-02-05 16:14:41	\N	已完成	亦東平安:\r\n\r\n\r\n\r\n可以的，AppSheet 支持 轉移應用程式所有權 (Transfer App Ownership)。\r\n\r\n這在員工離職、職務變動或是接案開發者交付成品給客戶時非常常用。轉移過程主要分為「發送請求」與「接受轉移」兩個步驟。\r\n\r\n以下是具體的操作流程與注意事項：\r\n\r\n1. 轉移所有權的步驟\r\n進入設定： 在 AppSheet 編輯器中，點擊左側選單的 Manage > Author > Transfer。\r\n\r\n填寫接收者 Email： 在 New Owner Email 欄位中，輸入你要轉交對象的 Email 地址（該對象必須擁有 AppSheet 帳號）。\r\n\r\n發送請求： 點擊 Transfer App。此時，App 會進入「待轉移」狀態。\r\n\r\n接收者確認： 接收者會收到一封電子郵件，點擊信中的連結並確認接收，轉移才算正式完成。\r\n\r\n\r\n2. 非常重要的注意事項（避坑指南）\r\n在轉移前，請務必確認以下幾點，否則 App 可能會失效：\r\n\r\n雲端儲存空間權限 (Data Source Permissions)： 這是最容易出錯的地方。AppSheet 只是「介面」，數據通常存在你的 Google Drive 或 Excel。轉移 App 所有權並不代表轉移了原始資料表的擁有權。\r\n\r\n建議做法： 轉移 App 後，你必須手動將 Google Sheets 或 Excel 的「編輯權限」也分享給新的所有者，或者將文件直接移轉到對方的雲端硬碟。\r\n\r\n白名單 (Whitelist)： 如果你的 App 是付費版本，轉移後，該 App 的計費將歸屬到新所有者的帳號下。\r\n\r\n自動化流程 (Automation)： 如果 App 中有設定「發送郵件」等自動化功能，轉移後，發件人的身分會切換為新所有者。	楊主恩	宣教六樓	\N	f
128	徐秀宜	@主恩alex 平安：Monique 請我設定她電腦開機登入密碼，她說還需要連NAS，再麻煩您跟她確認了，謝謝。	2026-02-08 08:09:27	2026-02-08 08:09:27	\N	已完成		楊主恩	宣教五樓	\N	f
129	許家鳳8457	pos系統無法用chrome下載excel報表	2026-02-10 14:12:13	2026-02-10 14:12:13	\N	已完成	群豐改用edge 解決	楊主恩	宣教11樓	\N	f
130	蘇秋敏	Gmail申請,潘麗娜加入tithe財務部群組/謝謝	2026-02-11 09:28:07	2026-02-11 09:28:07	\N	已完成	ok	楊主恩	宣教六樓	\N	f
131	張筱梵	主恩哥\r\n要請你幫忙把  許家鳳加入可以編輯事業處的行事曆中	2026-02-12 15:23:03	2026-02-12 15:23:03	\N	已完成	詳細操作步驟\r\n登入管理控制台： 前往 admin.google.com，使用管理員帳號登入。\r\n\r\n尋找使用者： 點擊左側選單的 「目錄」 > 「使用者」。\r\n\r\n進入使用者設定： 在清單中點擊該位無法登入的 「使用者名稱」（例如 mis.mgr）。\r\n\r\n展開安全性選項： 進入該使用者的詳細資訊頁面後，向下捲動找到 「安全性」 區塊並點擊展開。\r\n\r\n取得存取碼： 找到 「兩步驟驗證」 這一列，點擊右側的 「取得備用驗證碼」（如下圖所示的位置）。\r\n\r\n複製代碼： 系統會跳出一個視窗，顯示數組 8 位數的數字代碼。\r\n\r\n複製其中一組提供給該使用者。\r\n\r\n提醒： 每一組代碼只能使用一次。	楊主恩	愛鄰11樓	\N	f
132	徐秀宜	我的筆電ESet的部份需要麻煩您協助	2026-02-13 10:36:43	2026-02-13 10:36:43	\N	已完成	派送安裝工作即可	楊主恩	宣教5F	\N	f
144	許恆裕	我的教會帳號Gemini\r\n有很多對話用不到\r\n已標示--待刪除\r\n可否授權您用管理員權限\r\n幫我刪除這些對話\r\n謝謝！	2026-03-12 17:29:37	2026-03-12 17:29:37	\N	已完成	平安,剛與廠商確認還未開放這個功能,但會繼續向google原廠反應,謝謝	楊主恩	靈糧神學院	\N	f
133	蕭羿滋	移交桌面資料給許家鳳	2026-02-23 10:23:46	2026-02-23 10:23:46	\N	已完成	Google 共用雲端硬碟\\P_事業處官網\\夾羿滋移交	楊主恩	宣教11樓	\N	f
134	林志琅 8462	平安～倉庫有一台螢幕沒顯示，不知道是不是掛了，請問明天有人能來看一下嗎？	2026-02-23 15:09:31	2026-02-23 15:09:31	\N	已完成	主機板上的電源線重新插拔即可	楊主恩	倉庫	\N	f
135	廖學敏	安裝雙螢幕	2026-02-24 17:19:18	2026-02-24 17:19:18	\N	已完成	ok	楊主恩 謝侑均	宣教13樓	\N	f
136	呂健萍	HDMI線不良,支援一條DHMI線	2026-02-26 22:38:54	2026-02-26 22:38:54	\N	已完成		\N	宣教6樓	\N	f
137	蔡欣宜	螢幕無法投影	2026-03-01 10:51:56	2026-03-01 10:51:56	\N	已完成	紅色電源打開即恢復訊號	楊主恩	三樓兒主	\N	f
145	談宇中	遠端元正更換延伸器	2026-03-13 10:43:32	2026-03-13 10:43:32	\N	已完成	line元正視訊找到延伸器來更換	楊主恩	宣教五樓	\N	f
138	廖學敏	無法列印21天禁食禱告會資料	2026-03-02 19:20:16	2026-03-02 19:20:16	\N	已完成	列印至b台即可	楊主恩	愛鄰4樓	\N	f
139	蔡昇勳	換手機,安裝linkus	2026-03-03 11:16:23	2026-03-03 11:16:23	\N	已完成	掃描二維條碼即可	楊主恩	宣教11樓	\N	f
140	張嵐夢	登入BOL_STAFF WIFY	2026-03-04 18:21:37	2026-03-04 18:21:37	\N	已完成	OK	黃詩庭	宣教5樓	\N	f
141	陸沛理	今天晨禱後福音中心聚集改到3樓場地  需要人協助他設定Zoom	2026-03-06 12:35:13	2026-03-06 12:35:13	\N	已完成	直接以手機執行zoom	楊主恩 謝侑均	宣教3樓	\N	f
142	趙偉成	雲火柱沒畫面	2026-03-08 09:35:59	2026-03-08 09:35:59	\N	已完成	插上電源即可	楊主恩	山莊雲火柱	\N	f
143	郭姿吟	音控沒聲音	2026-03-10 18:06:45	2026-03-10 18:06:45	\N	已完成	PA切回四樓設定檔即可	楊主恩	宣教4樓	\N	f
149	陸沛理	BOL_guest無線網路太慢	2026-03-17 18:41:52	2026-03-17 18:41:52	\N	已完成	改上BOL_Works cowork@2024 即可	楊主恩	山莊服務台	\N	f
150	陳佩容 8455	安裝連台系統	2026-03-18 09:32:32	2026-03-18 09:32:32	\N	已完成	id:misadmin  pass:Mis7745....@	楊主恩	宣教11樓	\N	f
148	王健行	synology driver client每次出現如圖對話方塊,希望可以不要出現	2026-03-17 18:34:53	2026-03-17 18:34:53	\N	已完成	系統設定 → 隱私權與安全性 →「檔案與資料夾」\r\n\r\n你現在畫面已經在這 👍\r\n\r\n請做：\r\n\r\n點 SynologyDrive\r\n\r\n把下面所有勾選「取消」\r\n\r\n（如果能刪掉整個項目更好）\r\n\r\n✅ ③ 再開「完整磁碟存取」（更穩）\r\n\r\n👉 到：\r\n隱私權與安全性 → 完整磁碟存取\r\n\r\n把：\r\n👉 SynologyDrive 打開\r\n\r\n（這一步很重要，很多人少做這一步就會一直跳）\r\n\r\n✅ ④ 重新開啟 Synology Drive	楊主恩 謝侑均	山莊副控室	\N	f
147	郭姿吟	麥克風沒有聲音	2026-03-17 09:56:04	2026-03-17 09:56:04	\N	已完成	打開無線主機的電源即可	楊主恩	宣教4樓	\N	f
146	袁新梅	燈光旁的監控螢幕無法顯示	2026-03-14 19:53:32	2026-03-14 19:53:32	\N	已完成	打開排插電源即可	楊主恩	宣教主控台	\N	f
151	溫政芬 8528	10樓的接收器沒電,耳麥無法發出聲音	2026-03-18 10:32:13	2026-03-18 10:32:13	\N	已完成	接上行動電源就可發出聲音	楊主恩	宣教10樓	\N	f
152	陳文郁	連線bol_staff wify =>km.bolccc.taipei	2026-03-20 12:33:55	2026-03-20 12:33:55	\N	已完成	照sop設定即可	楊主恩	宣教5樓	\N	f
153	善敏	現場沒有電腦即麥克風聲音	2026-03-22 11:17:04	2026-03-22 11:17:04	\N	已完成	喇叭音源線插上即可	楊主恩	宣教12樓	\N	f
156	閻力行 7506	借麥克風來進行zoom會議	2026-03-26 08:09:43	2026-03-26 08:09:43	\N	已完成	ok	楊主恩	宣教5樓	\N	f
154	蔡翔麗 9358	更新防毒軟體	2026-03-24 15:50:31	2026-03-24 15:50:31	\N	已完成	NB已更新A07020148-25-04	楊主恩	古亭福音中心	\N	f
155	葉貞秀	安裝自然人憑證	2026-03-25 16:11:53	2026-03-25 16:11:53	\N	已完成	ok	楊主恩	宣教5樓	\N	f
157	吳宏棋	306教室從電視送出的音量是足夠的， 可以進行親子室轉播,thanks	2026-03-30 12:38:18	2026-03-30 12:38:18	\N	已完成		楊主恩 謝侑均	宣教3樓	\N	f
158	宣教13F副堂 8013	同步顯示設定	2026-03-30 12:40:27	2026-03-30 12:40:27	\N	已完成	ok	楊主恩	愛鄰13樓	\N	f
159	廖學敏	禱告殿電腦解開還原系統教學	2026-03-31 16:38:52	2026-03-31 16:38:52	\N	已完成	ok	楊主恩	宣教4樓	\N	f
160	簡靖維	不能列印	2026-04-05 08:45:21	2026-04-05 08:45:21	\N	已完成	ok	楊主恩 謝侑均	宣教5樓	\N	f
162	吳宏棋	六樓會議室，電視在HDMI1或2時，使用約5分鐘，會自己亂跳頻道到HDMI3	2026-04-08 15:13:40	2026-04-08 15:13:40	\N	已完成	Ok	楊主恩	宣教六樓會議室	\N	f
163	蔡翔莉	筆電滑鼠無法使用	2026-04-11 07:37:45	2026-04-11 07:37:45	\N	處理中		楊主恩	宣教5F	2026-04-12 00:16:10.641857+00	t
164	葉貞秀 8629	PDF無法使用acrobat PDF列印	2026-04-13 01:02:26	2026-04-13 01:02:26	\N	已完成	使用google chrome 列印即可	楊主恩	宣教5樓	\N	f
161	劉文煌	忘記列印密碼	2026-04-08 04:29:36	2026-04-08 04:29:36	\N	已完成	ok	楊主恩	宣教11樓	\N	f
165	區黃明輝師母	Outlook信件內容字太小	2026-04-12 17:07:58	2026-04-12 17:07:58	\N	已完成	如圖,zoom調大即可	楊主恩	宣教六樓	\N	f
166	劉梅香	設定掃描郵件	2026-04-15 16:54:31	2026-04-15 16:54:31	\N	已完成	印表機B	楊主恩	宣教5樓	\N	f
167	林羿伶 / 傳道	延伸桌面設定跑掉	2026-04-19 23:15:00	2026-04-19 23:15:00	\N	已完成	左邊螢幕設成主要螢幕即可	楊主恩	宣教五樓	\N	f
168	許琛翎 <chris.hsu@breadoflife.taipei>	Family@breadoflife.taipei群組信箱無法收信	2026-04-23 18:21:16	2026-04-23 18:21:16	\N	已完成	取消審核機制即可	楊主恩	宣教五樓	\N	f
169	劉文煌	wify bol_staff 設定	2026-04-24 01:30:26	2026-04-24 01:30:26	\N	已完成	ok	楊主恩	宣教五樓	\N	f
170	李婉慈	無法更改螢幕休眠=>永不	2026-04-24 18:40:48	2026-04-24 18:40:48	\N	已完成	chatgpt => support 密碼空白即可	楊主恩	山莊控台	\N	f
171	黃懿君	螢幕出現格子線	2026-04-24 18:44:01	2026-04-24 18:44:01	\N	已完成	chapgpt 建議重開機看到螢幕出現非電腦產生的訊息,確定是螢幕的問題,按下menu鍵,立即恢復正常	楊主恩	宣教五樓	\N	f
172	李婉慈	設定propresenter 23.1新版與同步	2026-04-24 20:38:29	2026-04-24 20:38:29	\N	已完成	ok	楊主恩	山莊控台	\N	f
173	思宇(淡水)	google workspace 無法通過NPO方案	2026-04-28 18:51:01	2026-04-28 18:51:01	\N	已完成	將google workspace 從business standard 降級成business starter即可通過NPO方案	楊主恩	宣教五樓	\N	f
174	蘇相瑀	電腦很慢	2026-04-29 23:36:19	2026-04-29 23:36:19	\N	已完成	重開機即可	楊主恩	愛鄰5樓	\N	f
175	蔡欣宜	電腦沒有聲音	2026-04-29 23:38:27	2026-04-29 23:38:27	\N	已完成	電腦重開即可	楊主恩 成威進	宣教3樓	\N	f
176	陸沛理	麥克風沒有聲音	2026-05-04 18:02:42	2026-05-04 18:02:42	\N	已完成	無線麥克風擴大機電源打開即可	楊主恩 謝侑均	愛鄰5樓	\N	f
\.


--
-- Name: ithelp_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dreamstream
--

SELECT pg_catalog.setval('public.ithelp_files_id_seq', 160, true);


--
-- Name: ithelps_id_seq; Type: SEQUENCE SET; Schema: public; Owner: dreamstream
--

SELECT pg_catalog.setval('public.ithelps_id_seq', 176, true);


--
-- Name: ithelp_files ithelp_files_pkey; Type: CONSTRAINT; Schema: public; Owner: dreamstream
--

ALTER TABLE ONLY public.ithelp_files
    ADD CONSTRAINT ithelp_files_pkey PRIMARY KEY (id);


--
-- Name: ithelps ithelps_pkey; Type: CONSTRAINT; Schema: public; Owner: dreamstream
--

ALTER TABLE ONLY public.ithelps
    ADD CONSTRAINT ithelps_pkey PRIMARY KEY (id);


--
-- Name: ithelp_files ithelp_files_ithelp_id_foreign; Type: FK CONSTRAINT; Schema: public; Owner: dreamstream
--

ALTER TABLE ONLY public.ithelp_files
    ADD CONSTRAINT ithelp_files_ithelp_id_foreign FOREIGN KEY (ithelp_id) REFERENCES public.ithelps(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict GfCzUagOfZuGI3n4ZyHyR1FfXU00WaNYPGeeiVlf7HeDPxiiPVXL1uZ2SIlobpa

