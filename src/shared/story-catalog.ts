import type { Live2dKind } from "./characters";
import type { ArcId, Evidence } from "./narrative";
export type Grant = Pick<Evidence, "id" | "title" | "text" | "type" | "owner" | "sharePolicy">;
export type StoryChoice = { id: string; label: string; to: string; result: string; flags?: string[]; requires?: string[]; any?: string[]; evidence?: string[]; grants?: Grant[]; public?: boolean };
export type StoryNode = { id: string; title: string; location: string; text: string; choices: StoryChoice[]; ending?: boolean };
export type StoryArc = { id: ArcId; title: string; invitation: string; nodes: Record<string, StoryNode> };
type Personal = { kind: Live2dKind; title: string; invitation: string; place: string;
  scenes: [string, string, string, string, string, string];
  actions: [string, string, string, string];
  endings: [string, string, string]; endingTitles: [string, string, string];
  proof: Omit<Grant, "owner" | "sharePolicy">; extras?: Omit<Grant,"owner"|"sharePolicy">[];
};
function personal(p: Personal): StoryArc {
  const grant = (sharePolicy: Grant["sharePolicy"]) => [p.proof, ...(p.extras ?? [])].map(g => ({...g, owner:p.kind, sharePolicy}));
  const node = (id:string, title:string, text:string, choices:StoryChoice[], ending=false):StoryNode => ({id,title,text,choices,ending,location:p.place});
  const choices = [
    {id:"verify",label:p.actions[2],to:"verify",result:"你选择先让材料接受核对，决定公开程度的事情留到核对之后。",flags:[`${p.kind}.verified`]},
    {id:"witness",label:p.actions[3],to:"witness",result:"你先询问当事人的边界，记录其说法；没有把说法当作已经核实的证据。",flags:[`${p.kind}.witness`]},
  ];
  return {id:p.kind,title:p.title,invitation:p.invitation,nodes:{
    start:node("start",p.title,p.scenes[0],[
      {id:"inspect",label:p.actions[0],to:"inspect",result:"你提出先查看留下来的物件，而不是要求对方马上作出承诺。",flags:[`${p.kind}.material-first`]},
      {id:"talk",label:p.actions[1],to:"talk",result:"你先询问对方愿意谈到哪里，让人而不是材料决定这次谈话的起点。",flags:[`${p.kind}.person-first`]},
    ]),
    inspect:node("inspect","留下来的东西",p.scenes[1],choices),
    talk:node("talk","当事人的说法",p.scenes[2],choices),
    verify:node("verify","核对之后",p.scenes[3],[{id:"continue",label:"带着核对结果谈下一步",to:"decision",result:"材料的出处已核对，是否允许公开仍未决定。"}]),
    witness:node("witness","谁来承担代价",p.scenes[4],[{id:"continue",label:"带着约定谈下一步",to:"decision",result:"当事人的边界已记录；有限合作不会被写成无条件授权。"}]),
    decision:node("decision","现在作出选择",p.scenes[5],[
      {id:"open",label:p.endingTitles[0],to:"open",result:p.endings[0],requires:[`${p.kind}.verified`],flags:[`${p.kind}.end.open`],grants:grant("public")},
      {id:"limited",label:p.endingTitles[1],to:"limited",result:p.endings[1],requires:[`${p.kind}.witness`],flags:[`${p.kind}.end.limited`],grants:grant("limited")},
      {id:"closed",label:p.endingTitles[2],to:"closed",result:p.endings[2],flags:[`${p.kind}.end.closed`, ...(p.kind === "miara" ? ["miara.departed"] : [])],
        grants:[{id:`${p.kind}-statement`,title:p.endingTitles[2],text:p.endings[2],type:"claim",owner:p.kind,sharePolicy:"limited"}],public:p.kind === "miara"},
    ]),
    open:node("open",p.endingTitles[0],p.endings[0],[],true),
    limited:node("limited",p.endingTitles[1],p.endings[1],[],true),
    closed:node("closed",p.endingTitles[2],p.endings[2],[],true),
  }};
}
const personalArcs: Personal[] = [
  {kind:"haru",title:"缺页的站务单",invitation:"陪 Haru 核对那张缺页的站务单",place:"零号站维修间 / 旧桥值班室",
    scenes:[
      "雨水从维修间的窗缝漏进来。Haru 把一叠旧站务单挪开，编号 46 后面直接接着 48。她没有把缺页藏起来，只说那一页不是丢的。你可以先看留下的编号，也可以问她为什么一直留着这叠纸。",
      "旧桥值班室的墙漆已经剥落。你们带来的站务单与门禁编号能够对上，最后一道闸门的签名属于 Haru。她让你看清自己的签字，才拿出封桥前收到的备选撤离方案。文件没有承诺所有人都能获救。",
      "Haru 承认，306 年她接受了缩小公开范围的内部处理，以此保住两名同事。她不愿让你把这件事解释成全无选择，但也不愿把同事的姓名当作自己坦白的代价。你们需要决定先核对文件，还是先讨论证人边界。",
      "签收时间、闸门编号与备选方案的附件彼此对应：封桥时她知道有人仍在另一侧，也知道存在不确定的其他方案。材料证明知情与执行，不能证明另一方案一定成功，更不能代替受害者判断。",
      "两名旧同事通过站务窗口表达了边界：愿意让事实接受核对，不愿住址和家庭被公开。Haru 同意先把可核对内容交给受影响者，完整公开则需要另行取得同意。你的提议改变了披露方式，没有替任何人赦免责任。",
      "Haru 把工号牌和文件并排放下。公开将让她失去独自决定站务的资格；有限交付保住证人边界，却留着公开责任的缺口。继续扣留也能暂时维持庇护，但她必须承认这仍是一次替别人把关。",
    ],actions:["去旧桥核对编号","先听她谈那次内部处理","核对签收时间与完整附件","先约定证人保护和交付范围"],
    endingTitles:["交出完整记录，接受站务审议","向受影响者有限交付","暂时保留文件"],
    endings:["Haru 交出包含自身签收记录的完整副本，接受站务权由多人临时共同管理。车站仍然开门，她仍会做饭修衣，却不能再用“我来处理”结束所有讨论。公开不是免责，后续调查还会继续。","Haru 将材料交给受影响者共同保管，保留证人身份与公开使用限制。你可以向少数指定的人展示材料，不能宣布获得了全城公开授权。她保住站务，也必须面对有人认为她仍在选择性坦白。","Haru 把文件放回有编号的盒子，明确承认自己选择继续保密。零号站的庇护因此变得有条件：有人接受，也有人不再把她当作中立守门人。你们仍能聊天，这个决定不会因为几句安慰自动变成勇敢。"],
    proof:{id:"haru-plan",title:"完整撤离备选方案",text:"封桥前 Haru 已签收不确定的备选撤离方案；她知情执行了最后一道闸门，事后接受过删减的公开报告。备选方案不保证成功。",type:"confirmed"}},
  {kind:"mao",title:"没有剪掉的声音",invitation:"和 Mao 听一遍没有剪掉的录音",place:"虹幕街排练厅",
    scenes:[
      "排练厅没有观众。Mao 让一段掌声循环播放，路线会议的录音盒却放在控制台另一端。她说公开版本已经足够响亮。你可以要求比较两个版本，也可以问她为何还留着原件。",
      "两个波形在同一处出现差异。公开版缺少 Mao 建议集会靠近转播塔的发言；原件里，她也承认那条路撤离困难。她关掉掌声，没有否认剪辑，却反问未经编排的事实究竟能被谁听见。",
      "Mao 讲起自己如何让工伤名单第一次被全城看见。那是真的，她对传播的控制也是真的。她愿意讨论自己删去的那句话，但拒绝把父亲遭到替罪的事实交给对手用作反击。两件责任不能互相抵销。",
      "录音的连续底噪、时间标记与公开演出稿能对上。她另拿出 311 年的局部断电调度单：这是另一次行动，不能把 305 年的路线录音拿来证明黑昼的全部原因。她当时没有预测全城停钟。",
      "你们谈妥一种有限放映：原件允许指定的人查验，Mao 仍保留公开剪辑与播出顺序。她提醒你，这不是交出解释权。你可以接受这笔交换，也可以在最终决定时退出，不必把合作说成信任。",
      "控制台上有原录音、断电调度单和宣传版本三份不同材料。她愿意在经过核验后交出原件，或者接受有限查验，或者继续靠剪辑掌握故事。没有哪个选项能让已经发生的危险变得无害。",
    ],actions:["比较原件与公开版本","问她为何留下原件","核验录音和断电调度单","商量有限放映与使用边界"],
    endingTitles:["交出原件及解释权","允许查验，保留传播权","继续发布删改版本"],
    endings:["Mao 交出两份原始材料，允许他人自行引用和质疑。她仍擅长演出，也仍有野心；这次失去的是对解释顺序的独占。她没有要求掌声来抵消旧桥的风险。","Mao 允许少数指定对象查验原件，但公开发布仍须另议。她继续掌握舞台，也获得一份有边界的合作。联合讨论可以引用核对结果，不能把它伪装成已获无限传播授权。","Mao 收回原件，用精心剪过的版本完成新的演出。更多人愿意听她，完整因果仍被遮住。你留下的是她的说辞，不是能够证明黑昼全貌的材料；她不会因为这条路线被系统强制悔改。"],
    proof:{id:"mao-recording",title:"路线会议原录音",text:"Mao 在 305 年主动推动靠近转播塔、撤离困难的集会路线，后来从公开录音删去自己的建议。",type:"confirmed"},
    extras:[{id:"mao-blackout",title:"局部断电调度单",text:"311 年 Mao 策划的是局部断电，并委托 Hijiki 运送切换部件；她未预测全城七分钟停钟，也没有在当时得知 Miara 的行动。",type:"confirmed"}]},
  {kind:"hiyori",title:"晚到的维修口令",invitation:"陪日和查那段晚到的维修口令",place:"食堂后门 / 铜轨区维修房",
    scenes:[
      "食堂准备打烊，日和在旧工具箱里找到一张写着父亲维修口令的纸。登记时间晚于白潮事故。她没有马上说“他还活着”，而是把灯重新打开，问你愿不愿意一起看清这条记录能说明什么。",
      "维修房的门已经换过锁。留下的工单能与修一的习惯用语对应，但系统可能调用过旧口令，回声也会重复熟悉的动作。一个晚出现的时间戳并不等于一个人当时就在这里。",
      "日和说起自己伪造过的票据，也承认销毁名单时怕别人追究她。她不想让“失踪者的女儿”成为拒绝核验的护身符。这次是否继续查下去，仍然是她对今后生活的选择。",
      "你们对照纸张批次、维修工序和口令来源。能确认部分记录源于修一，也能确认装置后来调用过它；不能确认修一肉身的生死。日和把这两句话分别写下，不让希望抹掉证据边界。",
      "食堂的常客愿意帮忙整理名字，但不愿姓名被拿去制作宣传。日和决定可以先交出匿名的工序与时间，不必把每个人的经历交给全城评判。生活也需要明天有人开门做饭。",
      "旧工单在一边，明天的食材清单在另一边。她可以继续做民间记录者，也可以把追查交给有边界的档案合作，或暂时封存这件事。开食堂不是不勇敢，继续查找也不保证找到父亲。",
    ],actions:["去维修房核对工单","听她说为什么害怕继续查","对照口令来源和工序时间","约定匿名记录和生活边界"],
    endingTitles:["继续保存具体人名","交接线索，经营食堂","暂时封存，留待以后"],
    endings:["日和决定持续保存可核验的工单和自愿留下的姓名。她成为民间记录者，却没有因此找到父亲。食堂每周仍有固定开门的时候，调查不再被要求吞掉全部生活。","日和把匿名工序与时间记录交给有限的档案合作，重新安排食堂的日常。她允许追查继续，不再要求自己每天守着它。这是一种有边界的生活，不是失败结局。","日和把纸张装进防潮袋，写下重新打开它所需的条件，今晚照常关灯。父亲的下落仍未知。联合讨论只能使用她愿意讲出的线索，不能把封存误写成证据已经公开。"],
    proof:{id:"hiyori-maintenance",title:"维修口令来源记录",text:"部分维修记录和回声源于桃濑修一，事故后装置调用过旧口令；这些材料不足以确认修一的肉身生死。匿名工序可用来核对供能变化。",type:"confirmed"}},
  {kind:"miara",title:"站台下面的新叶",invitation:"和 Miara 看看站台下面的新叶",place:"废弃站台 / 风庭边界",
    scenes:[
      "旧站台的裂缝里长出一片新叶，Miara 却没有露出轻松的神色。那是仍与城区相连的供能根。她带来第二次断根的草图，你可以先看它连接了哪里，也可以问她在风庭答应过什么。",
      "根线图把风庭、铜轨区与一段旧供能支路连在一起。切断可以保护季节轮转，也会使部分城区失去稳定能源。图上没有人的名字，走访记录里却有。Miara 同意把两份材料并排看。",
      "Miara 说，族人不应继续为城市违约买单。她也承认自己当年支持过交换协议，不能把所有后果归给别人。塞芙的求救回声仍是她不愿轻易触及的旧事，不会因为今天谈合作就被改写成毫无选择。",
      "根系记录说明 311 年她主动拔除了连接根，知道会停电，却不知道 Mao 同时在操作转播系统。城区工序记录可以支持分期脱离的讨论，但不会凭空创造无限能源。需要负担损耗的一方必须参与决定。",
      "风庭要求有期限、有监督的脱离安排，铜轨区居民要求停供前有迁移时间。Miara 愿意讨论分期方案，却不答应无限延期。你们先记录双方都能拒绝的条件，而不是用一句“共存”盖过账目。",
      "她将草图压在站台灯下。共同管理意味着风庭继续承担有上限的损耗；分期脱离意味着居民面对可预见的紧缩；立即断根则会造成真实停供。你只能提出方案，不能替她把族群责任删除。",
    ],actions:["沿根线看受影响城区","先听风庭提出的条件","核对 311 年操作和供能记录","谈分期脱离的期限与监督"],
    endingTitles:["建立有条件的共同管理","签下分期脱离约定","接受她断根离城"],
    endings:["Miara 参与共同管理，公布历史根系操作，并为持续供能设立可检查的上限。风庭付出损耗，城区接受削减和监督；没有一方得到无限许诺。她仍坚持族群责任，温和并不等于服从。","Miara 同意分期脱离，由有限的共同保管者检查时间和损耗。城区开始调整供能，风庭也承担过渡期的代价。这条路线留下谈判窗口，不把暂缓断根称作永久和解。","Miara 选择立即断根并离开临界城。部分城区失去供能，居民需要迁移，零号站保留通信窗口。她没有被改写成无害的自然使者；后续现场不会突然出现她，除非通过明确的通信联系。"],
    proof:{id:"miara-roots",title:"311 年根系操作记录",text:"Miara 在 311 年主动拔除风庭连接根系，知道城市会停电，但当时不知道 Mao 的同步局部断电行动。两者与部件运输需要对照，才能解释完整黑昼。",type:"confirmed"}},
  {kind:"rice",title:"未提交的演算",invitation:"和 Rice 看看那份未提交的演算",place:"零号站书房",
    scenes:[
      "Rice 将公开决策书放在桌面，私人演算留在抽屉里。有人要求她解释为什么当年没有提交另一种可能。她没有否认文件存在，只问你打算怎样对待一个不确定、却真实存在的方案。",
      "公开命令有她的签名，私人演算有更慢的撤离路线和多处失败风险。封桥确实保护了中央医院，也确实使 46 人被困、23 人失踪。这两份数字不能相互抵销。",
      "Rice 认为掌握全部不确定性的人理应负责决策。你问她谁有权检查那个“全部”。她提到导师艾妲，也承认认真工作不能证明一个人有权隐去不利材料。她仍不认为每一次残酷选择都能靠道歉解决。",
      "不同版本的演算能对上参数和时间：替代方案存在，成功率不确定，Rice 知道并选择未向官方审议完整提交。她同时带来的半份总账只能证明其中的账户，不能补出另一半缺失内容。",
      "有人愿意接受她提供临时技术方案，前提是期限、公开失败记录和外部复核写进约定。Rice 对监督方式提出反对，也给出了可执行的最低条件。有限权力仍是权力，不是自动悔改。",
      "私人演算和半份总账现在可以有不同的归属：交付审议、在有限监督下使用，或继续由她独占。你可以支持一种安排，也可以拒绝合作；不能用喜欢她来替受影响者同意。",
    ],actions:["比较决策书和私人演算","问谁有权检查她的判断","核对参数、签名和总账范围","商定临时治理的监督条件"],
    endingTitles:["接受公开审议","接受有限监督的临时治理","保留信息，争取集中决策"],
    endings:["Rice 交出私人演算和半份总账，接受公开审议。她仍会为部分判断辩护，但不能再只交自己愿意让人看的参数。临时方案由多人复核，问责没有因为她有能力而消失。","Rice 接受有期限的临时治理和有限监督。材料由指定保管者核验，公开引用另有约定。她仍自负而强硬，但每次延续权力都需要解释，而不是默认永久授权。","Rice 保留材料，选择争取集中决策权。她可以提出可行方案，却失去某些人的无条件合作。联合听证中会把她的保证标作说辞，不能用政治权威替代未公开的演算。"],
    proof:{id:"rice-calculation",title:"私人撤离演算",text:"Rice 知道存在较慢且不确定的替代撤离方案，仍选择封桥并未向官方审议完整提交私人演算。封桥保护医院不取消对被困者的责任。",type:"confirmed"},
    extras:[{id:"rice-ledger",title:"结算总账的半份原件",text:"Rice 持有的半份总账记录了部分配额与账户。它可接受核验，但不代表缺失的另一半已经找到。",type:"confirmed"}]},
  {kind:"tororo",title:"坐垫下的印章",invitation:"陪 Tororo 看看坐垫下的旧印章",place:"窗台 / 沉页馆旧柜",
    scenes:[
      "换洗坐垫时，一枚缺角印章滚到窗台边。Tororo 用爪子压住它，说旧东西容易弄脏桌子。他没有睡着。你可以先问缺角意味着什么，也可以问他为什么把它放在身边这么多年。",
      "印章缺口与一批旧封页的印痕能够对应。Tororo 认得它，不代表他理解机器如何取时。他记得 298 年有人换掉风险报告封页，也记得自己当时选择留下。",
      "Tororo 承认 300 年调查员来问时，他说过不知道。新住处和不再工作的承诺没有写成交易，他却清楚它们并非无关。舒服的生活给了他理由，也让那些理由越来越难拆开。",
      "印痕、封页纸张和登记顺序能证明报告被替换，不能证明档案室里每个人的全部动机。Tororo 的证词补上了他亲眼看见的部分，同时留下需要追究的撒谎。你们没有把一只猫写成幕后总指挥。",
      "他提出先交一份匿名说明，让印章接受核验，暂不公开住处和姓名。Haru 的庇护可以保护居住边界，却不能替他取消证词责任。你愿不愿意接受有限合作，会影响他接下来肯交出什么。",
      "围巾和印章放在同一张椅子上。实名作证可能失去原有便利；匿名证据能打开调查，却留下责任缺口；继续装困则会让别人重新判断他的沉默。无论怎么选，他都不必突然变成勇敢战士。",
    ],actions:["核对印章缺口","问他为什么一直留着它","对照封页与登记顺序","先讨论匿名证词的边界"],
    endingTitles:["实名说出看见的事实","提供可检验的匿名线索","暂不作证，承认仍在拖延"],
    endings:["Tororo 在证词上留下名字，明确写出自己看见过封页更换，也向调查员说过谎。他失去一部分旧庇护，但窗台仍有地方休息。承担责任没有抹掉他的懒散，也不要求用户替他赎罪。","Tororo 交出可检验的印痕和匿名说明，只允许指定对象核对。调查得以继续，谁在 300 年说谎的问题仍未公开回答。有限帮助值得记录，不能被夸成完整坦白。","Tororo 没有交出印章。他这次承认自己仍想拖延，而不是声称一无所知。庇护者会调整合作条件，用户仍可和他聊午饭；没有证据就不能替调查宣布结案。"],
    proof:{id:"tororo-seal",title:"封页替换印痕",text:"旧印章磨损与 298 年被更换的风险报告封页吻合；Tororo 亲眼看过更换，并在 300 年向调查员否认见过相关文件。他不掌握机器全部原理。",type:"confirmed"}},
  {kind:"hijiki",title:"没有寄出的回信",invitation:"和 Hijiki 看一看没有寄出的回信",place:"零号站屋顶 / 交接窗口",
    scenes:[
      "Hijiki 把洛克的旧信压在缺齿通行牌下面。信写于被捕之前，没有控诉未来发生的事。他另有一叠交接凭据，你可以先把不同年份分清，也可以问他为什么还没有写完回信。",
      "298 年出售接头路线、305 年出售旧桥撤退路线、311 年运输断电部件是三件事。Hijiki 逐一摆出记录，不允许把后来救过几个人写成前两笔交易的退款。旧信也不会突然变成黑昼的密码本。",
      "他知道洛克被捕，仍不知道洛克现在在哪里。守合同让他重新获得生意，却没有让那笔欠账消失。你可以听他解释用途被低估的经过，但不能代洛克决定是否原谅。",
      "交接凭据记录了 Mao 委托、切换部件和预期局部停电的时间。它与根系行动无关，需要别的来源才能解释全城黑昼。交出原文会暴露 Hijiki 曾经怎样为自己保留退路。",
      "Hijiki 愿意把凭据交给有限的共同保管者，要求每次引用注明范围，不能把文件转卖。你也保留退出交易的权利。这份约定比“永远可靠”短，却比一句漂亮保证更可核对。",
      "回信还没有收件地址，凭据却已经可以决定去向。坦白不会让失踪者自动归来；共同保管仍带交易边界；继续等价码则意味着有些人不再先给信任。他把这三个代价都说在前面。",
    ],actions:["先把三份不同年份的记录分开","问他没有写完的那句话","核验 311 年交接凭据","约定有限共同保管"],
    endingTitles:["交出完整凭据并承担后果","实行有限共同保管","继续等待有利时机"],
    endings:["Hijiki 交出完整交接凭据，承认两次路线交易与一次部件运输各自的责任。他失去部分交易筹码，保住的是不再把每句话都当作撤退路线的可能。洛克仍然下落不明。","Hijiki 将凭据交给有限的共同保管者，保留使用和转交限制。你们得到具体、可验证的合作，尚不是没有条件的忠诚。联合讨论必须尊重这份边界，或重新协商。","Hijiki 保留凭据，继续等对自己有利的时机。他没有否认交易，却也没有提供足以核验黑昼的原文。有些合作因此终止；他仍能与用户平等聊天，不拿现实秘密索要价码。"],
    proof:{id:"hijiki-receipt",title:"黑昼部件交接凭据",text:"311 年 Hijiki 接受 Mao 的委托运输切换部件，预期造成局部停电，未获知 Miara 同时断根。此凭据不同于 298 年及 305 年两次路线交易。",type:"confirmed"}},
];
function jointNode(id:string,title:string,text:string,choices:StoryChoice[],ending=false):StoryNode {
  return {id,title,text,choices,ending,location:"零号站公共候车室"};
}
const joint: StoryArc = {id:"joint",title:"第八分钟",invitation:"参加零号站的联合听证",nodes:{
  start:jointNode("start","空着的第八分钟","来自不同路线的线索终于摆到同一张桌子上。停战约只保证能够说话，不保证彼此相信。只有主动展示的证据会进入公共讨论，角色私聊仍留在原来的窗口。",[{id:"begin",label:"列出可公开的材料",to:"evidence",result:"听证开始。未获公开授权的材料仍由原持有人保管。",public:true}]),
  evidence:jointNode("evidence","谁看见了什么","先在证据页选择愿意展示的材料。原录音、印章和演算证明的不是同一件事；谁的说辞更动听，也不能补上缺失的出处。可以在材料不齐时继续，但必须保留未决问题。",[{id:"bridge",label:"先核对白潮与旧桥",to:"bridge",result:"你提出按事件发生顺序核对，不按人物声望投票。",public:true},{id:"blackout",label:"先对照黑昼的三段行动",to:"blackout",result:"讨论转向黑昼，各方只能确认自己知道的一段。",public:true}]),
  bridge:jointNode("bridge","命令之外的名字","封桥保护过医院，也造成了被困和失踪。完整方案、私人演算和档案印痕需要各自的出处。没有展示的文件不能被主持人一句话变成公共事实。",[{id:"record",label:"保留责任争议，继续核对黑昼",to:"blackout",result:"听证记录保留旧桥责任与未核实部分，保护医院不被写成自动免责。",flags:["joint.accountability"],public:true}]),
  blackout:jointNode("blackout","三个没有约好的动作","Mao 的局部断电、Hijiki 的部件运输、Miara 的根系操作需要三份独立出处。两份吻合仍不等于第三份已经存在。",[
    {id:"confirm",label:"用三份公开原件确认叠加因果",to:"supply",result:"三份原件对照确认：多个行动叠加造成全城七分钟停钟，没有任何一人完整预见结果。",evidence:["mao-blackout","hijiki-receipt","miara-roots"],flags:["joint.blackout-confirmed"],public:true},
    {id:"incomplete",label:"记为成因尚不完整，继续讨论供能",to:"supply",result:"黑昼成因仍不完整。后续方案不以虚构的完整真相为前提。",flags:["joint.blackout-incomplete"],public:true},
  ]),
  supply:jointNode("supply","灯不能只靠立场亮着","候车室的灯需要实际供能。风庭继续供能有损耗，分区脱离会让城区紧缩，集中调配也不是免费午餐。已离城的人不会突然回到座位上。",[
    {id:"shared",label:"提出有上限的共同供能",to:"hearing",result:"共同供能进入议程，必须保留可检查的上限和退出条件。",any:["miara.end.open","miara.end.limited"],flags:["joint.supply-shared"],public:true},
    {id:"district",label:"准备分区脱离与居民迁移",to:"hearing",result:"各区准备承担脱离后的紧缩和迁移，不能宣称零损失。",flags:["joint.supply-district"],public:true},
    {id:"central",label:"讨论 Rice 的临时集中调配",to:"hearing",result:"集中调配作为有代价的候选方案进入议程，不等于已经永久授予权力。",any:["rice.end.open","rice.end.limited","rice.end.closed"],flags:["joint.supply-central"],public:true},
  ]),
  hearing:jointNode("hearing","让受影响者说完","记录中出现了维护食堂、保护住处和追问失踪者的不同要求。它们不能被一句“为了大局”合并。你可以选择让完整记录成为公共基础，或允许策划者继续控制叙述。",[
    {id:"open",label:"保留公开质疑与更正权",to:"terms",result:"公开质疑和记录失败成为议程的一部分。",flags:["joint.open-process"],public:true},
    {id:"curate",label:"接受由 Mao 编排公开顺序",to:"terms",result:"Mao 得到编排顺序的空间；她的选择性披露会被记录为权力，而不是中立传播。",any:["mao.end.open","mao.end.limited","mao.end.closed"],flags:["joint.curated"],public:true},
  ]),
  terms:jointNode("terms","先写下不能做什么","任何安排都需要写明资料归属、引用范围和失败后由谁解释。你可以推动可撤回的授权，也可以接受更集中的权力，并承担有人拒绝继续合作的后果。",[
    {id:"review",label:"设定外部审议和撤回条款",to:"decision",result:"方案必须接受外部审议，不能凭一次选择获得永久免责。",flags:["joint.review"],public:true},
    {id:"delegate",label:"承担集中授权的风险",to:"decision",result:"集中授权的风险被明确记录，其他人保留反对和退出的权利。",flags:["joint.delegated"],public:true},
  ]),
  decision:jointNode("decision","总账交给谁","不同材料的公开程度、人物已经作出的选择与供能现实限制了可行方案。暂不决定也可以：先回个人线继续获取材料，再回来讨论。",[
    {id:"public",label:"实行分权公开",to:"publicEnd",result:"总账资料由多方保管，受影响者拥有质疑与更正权。供能继续但有上限，各方承担持续损耗；没有人因此被赦免。",requires:["joint.open-process","joint.review","joint.supply-shared"],flags:["joint.end.public"],public:true},
    {id:"central",label:"接受集中接管",to:"centralEnd",result:"Rice 获得集中调配权。记录保留她未公开和已经公开的部分，执行效率提高，拒绝集中权力的人退出部分合作；问责仍是未解决的冲突。",requires:["joint.supply-central"],flags:["joint.end.central"],public:true},
    {id:"stage",label:"让传播者掌握解释顺序",to:"stageEnd",result:"Mao 掌握总账故事的播出顺序，公众听见更多也仍只听见被选择的部分。她获得新的力量，完整资料的归属继续成为冲突。",requires:["joint.curated"],flags:["joint.end.stage"],public:true},
    {id:"depart",label:"保留争议，实行分区脱离",to:"departEnd",result:"各区停止等待统一答案，接受分区供能、紧缩与迁移。风庭与城市的分离不是没有代价的胜利；未公开的责任继续留在记录里。",requires:["joint.supply-district"],flags:["joint.end.depart"],public:true},
    {id:"reconsider",label:"回到材料桌，重新讨论方案",to:"evidence",result:"听证暂缓，没有给人物关系扣分，也没有强行宣布结局。",public:true},
  ]),
  publicEnd:jointNode("publicEnd","没有唯一保管人的账本","公开与供能都进入共同检查。不同立场仍会争执，失踪者没有因此回来。零号站重新开门，下一顿饭比宣告所有问题解决更可信。",[],true),
  centralEnd:jointNode("centralEnd","亮着灯的窄门","供能恢复了更清楚的调配链，代价是决定权再次集中。Rice 不把这叫作悔改，反对者也没有消失。个人线留下的责任没有被治理成果抵销。",[],true),
  stageEnd:jointNode("stageEnd","掌声之后的原件","街上的人开始谈论总账。Mao 决定哪些片段先出现，质疑者继续寻找未播出的原件。传播确实改变了城市，也制造了新的把关者。",[],true),
  departEnd:jointNode("departEnd","各自的归途","灯光不再整齐划一。有的区域进入紧缩，有的人开始迁移；风庭也要承担脱离后的责任。零号站保留通话窗口，允许人继续争论，也允许今晚先休息。",[],true),
}};
export const storyCatalog = Object.fromEntries([...personalArcs.map(personal),joint].map(a=>[a.id,a])) as Record<ArcId,StoryArc>;
