// Lanternfall — story: NPCs, dialogue, lore tablets, tutorial signs
'use strict';
var LF = globalThis.LF || (globalThis.LF = {});
(function () {
  const bosses = (S) => S.bosses.length;
  const once = (S, k) => { if (S.flags[k]) return false; S.flags[k] = 1; return true; };

  // Moving NPCs: which placement stage is currently active
  LF.npcStage = function (id, S) {
    const b = bosses(S);
    if (id === 'vell') return b < 2 ? 0 : b < 4 ? 1 : b < 6 ? 2 : b < 9 ? 3 : 4;
    if (id === 'cask') return b < 4 ? 0 : b < 8 ? 1 : 2;
    if (id === 'oro') return Math.min(4, Math.floor(b / 2));
    return undefined;
  };

  LF.NPCS = {
    mirelle: { name: 'Mirelle', title: 'Moth Merchant', look: 'moth', col: '#c8a2d8', col2: '#ffe0a0',
      talk(S) {
        if (once(S, 'met_mirelle')) return { lines: ['Oh! Oh my. A Wick — a little living flame, walking about all on its own!', 'I\'m Mirelle. I\'ve kept this shop lit since before the Lantern went out. Glimmer for goods, dearie. It\'s the only honest trade left in Umbravale.'], then: 'shop:mirelle' };
        const l = bosses(S) >= 7 ? 'You smell of cinders and old prayers. Business must be good!' : bosses(S) >= 4 ? 'They say the bells in the city rang once, just once, after you passed through. Was that you?' : bosses(S) >= 1 ? 'Your flame looks brighter than before. Spend some of that shine, hm?' : 'Back again? Have a look, have a look.';
        return { lines: [l], then: 'shop:mirelle' };
      } },
    thrennic: { name: 'Thrennic', title: 'Old Smith', look: 'beetle', col: '#6a5a4a', col2: '#ffb35a',
      talk(S) {
        if (once(S, 'met_thrennic')) return { lines: ['Hrm. A Wick with a pin. Let me see that.', '...Barely sharp enough to butter bread.', 'Name\'s Thrennic. I forged blades for the Wick-Guard, back when there was a Wick-Guard. Bring me glimmer, and pale ore for the finer work, and I\'ll make that pin sing.'], then: 'smith' };
        if (S.nail >= LF.NAIL.length - 1) return { lines: ['Nothing left to teach that blade. It\'s a Lanternblade now. Use it well.'] };
        return { lines: [S.nail > 0 ? 'Back for more? That edge is holding up. Let\'s make it better.' : 'Pale ore glows faintly, like a coal that won\'t go out. Look in the deep places.'], then: 'smith' };
      } },
    penna: { name: 'Penna', title: 'Cartographer\'s Wife', look: 'bug', col: '#7a8a6a', col2: '#fff0c0',
      talk(S) {
        if (once(S, 'met_penna')) return { lines: ['Welcome, welcome! I\'m Penna. My husband Quillon is out there somewhere, scribbling maps of the deep.', 'If you meet him, buy his maps. Somebody has to pay for all that ink! I sell the pins and inks to mark them up.', 'Oh, and press [map] to look at your map, and [inv] to see what you carry.'], then: 'shop:penna' };
        return { lines: [S.flags.quillon_met ? 'You met Quillon? Is he eating? He never eats. He eats ink, I think.' : 'Pins, inks, all the finest map-marking supplies!'], then: 'shop:penna' };
      } },
    lumen: { name: 'Grandmother Lumen', title: 'Eldest of the Wisps', look: 'wisp', col: '#fff3c4', col2: '#ffd27a',
      talk(S, G) {
        const lines = [];
        if (once(S, 'met_lumen')) lines.push('...Come closer, little flame. My eyes have grown dim.', 'I am Lumen, eldest of the wisps. When the Lantern died, my children scattered into the dark like frightened moths.', 'If you find them, they will follow your light. Bring them home to me, and I will give you what little I have.');
        if (S.wisps > 0) {
          const n = S.wisps; S.wispsHome += n; S.wisps = 0;
          lines.push(n === 1 ? 'Oh! One of my little sparks! Welcome home, welcome home...' : `Oh! ${n} of my little sparks, all together! Welcome home...`);
          const got = G.grantWispRewards();
          got.forEach(g => lines.push('Take this, for your kindness: ' + g + '.'));
          if (S.wispsHome >= 24) lines.push('All of them... every last spark is home. I can see again, little flame. I can see you.');
        }
        if (!lines.length) lines.push(S.wispsHome >= 24 ? 'My family is whole. Go now, and shine.' : `${S.wispsHome} of my 24 children have come home. The rest are still out there in the dark.`);
        return { lines };
      } },
    quillon: { name: 'Quillon', title: 'Cartographer', look: 'quill', col: '#8a7a5a', col2: '#fff0c0',
      talk(S, G) {
        const reg = G.room.def.region, nm = LF.REGIONS[reg].name, price = LF.MAP_PRICES[reg];
        const lines = [];
        if (once(S, 'quillon_met')) lines.push('Hm-hm-hmmm... oh! Don\'t step on that, it\'s the eastern stair! ...Well. A drawing of it.', 'Quillon, cartographer! I map the deep so that nobody gets lost. Well. So that fewer get lost.');
        const flavor = {
          umbravale: 'Old Umbravale was the first city. They built it around the Lantern\'s light, ring upon ring, all the way down.',
          mossdeep: 'The thicket grows a hand\'s breadth every night. My maps are always wrong by morning. Still, roughly right is better than lost!',
          aurel: 'Aurel\'s scribes mapped everything. I found one of their maps once. It was a map of a map. Dreadfully confusing.',
          glasswyrm: 'Listen! Do you hear it? The crystals hum. Something big sings back to them, deep down.',
          quietbells: 'Shh! Not too loud. The city doesn\'t like noise. Neither do my nerves.',
          mirrorlake: 'Don\'t look too long at your reflection here. Mine winked at me once. I didn\'t wink first.',
          cinderdeep: 'Hot, hot, hot! My ink keeps boiling! This map is mostly smudges and hope.',
          veiledeye: 'I feel watched in this temple. Not unkindly. Just... thoroughly.',
          gloamreach: 'I shouldn\'t be here. Nobody should. But a map is a map, and a blank space is an insult.',
        }[reg];
        if (flavor) lines.push(flavor);
        if (!S.maps.includes(reg) && price) return { lines, then: { ask: `Buy the map of ${nm} for ${price} glimmer?`, yes: () => G.buyMap(reg) } };
        lines.push('Have you met my wife Penna in Lanternwatch? She sells pins for these maps. Tell her I\'m eating properly. I am not.');
        return { lines };
      } },
    vell: { name: 'Vell', title: 'Pilgrim', look: 'pilgrim', col: '#9a8aa0', col2: '#ffe9b0',
      talk(S) {
        const st = LF.npcStage('vell', S), k = 'vell' + st, first = once(S, k);
        const D = [
          ['Peace, little flame. I am Vell, a pilgrim of the old faith.', 'I walk to see the Lantern\'s Heart before I forget my own name. Most who walk the dark forget. The Gloam takes the names first.', 'The Warden still guards the Fallen Gate below us. He was kind, once. Now he only remembers the gate.'],
          ['You again! Aurel\'s scribes wrote everything down, you know. Every birth, every death, every song.', 'They thought that if it was written, the Gloam couldn\'t take it. They were half right. It took the scribes instead.'],
          ['The City of Quiet Bells. The Bellwright silenced every bell so the Gloam couldn\'t hear us. Clever. And terrible.', 'My feet are slow now. Go on ahead. I\'ll see you somewhere warmer.'],
          ['The Oracle saw the end of Umbravale a hundred years before it came. Nobody listened. Nobody ever listens to oracles.', 'She also saw a small flame climbing toward the Heart. I think... I think she meant you.'],
          ['I made it. I can see the Heart from here... it\'s so dark.', 'My name is Vell. I still remember it. Thank you, little flame.', 'Whatever waits up there, she was our Queen. Be gentle, if you can.'],
        ];
        return { lines: first ? D[st] : [D[st][D[st].length - 1]] };
      } },
    cask: { name: 'Brother Cask', title: 'Ninth Wick-Guard', look: 'knight', col: '#7a6a5a', col2: '#ffcf7a',
      talk(S, G) {
        const st = LF.npcStage('cask', S);
        if (st === 0) return { lines: once(S, 'cask0') ? ['Ho there! Brother Cask of the Ninth Wick-Guard, at your service!', 'I\'m on a quest, the noblest kind. My captain, the First Wick, went into the deep to fight the Gloam and never returned.', 'I shall find him and bring him home! ...Once I find my way out of this thicket.'] : ['These thorns are a test of my resolve. My resolve is holding. My cloak is not.'] };
        if (st === 1) return { lines: once(S, 'cask1') ? ['Little Wick! You\'ve grown brighter. Me? I\'ve grown lost.', 'The city watch chased me for three days. I think they wanted to arrest me for trespassing. Or for my singing.', 'I\'ve heard whispers that the First Wick sits on a throne beneath the kingdom. Beneath it! Can you imagine?'] : ['Onward! Probably that way. Or that way.'] };
        if (!S.charms.includes('oathbound')) { G.giveCharm('oathbound'); return { lines: ['A fallen knight lies here. His shell is cracked and his lantern is cold.', 'Clutched in his hands is a sigil, still warm.', 'He found his captain.'] }; }
        return { lines: ['Brother Cask rests here. He found his captain.'] };
      } },
    oro: { name: 'Oro', title: 'Masked Bard', look: 'bard', col: '#5a4a6a', col2: '#fff',
      talk(S) {
        const st = LF.npcStage('oro', S);
        const D = [
          ['♪ A little flame went walking, walking, down where the lanterns sleep... ♪', 'Ah, an audience! I am Oro. I sing of endings. Yours hasn\'t been written yet. How exciting.'],
          ['♪ The glass worm sings in colours no ear was ever meant to hear... ♪', 'You have felled several of the old guardians. Do you ever wonder who they were before? I do. I write the verses.'],
          ['♪ The mother of the lake still weeps, and every tear\'s a sea... ♪', 'Grief, little flame, is only love with nowhere left to go. Remember that when you meet the Queen.'],
          ['♪ The hammer falls, the forge grows cold, the tyrant bows his head... ♪', 'Almost done, almost done. And then what? The song needs an ending. I hope it\'s a kind one.'],
          ['♪ The First Wick sits on a throne of night, and waits for the last to come... ♪', 'He was the brightest of all of you, you know. Brighter than the Queen herself. That\'s why the Gloam wanted him most.', 'Go on. I\'ll be singing for you.'],
        ];
        return { lines: D[st] };
      } },
    ilse: { name: 'Ilse', title: 'Drowned Scholar', look: 'ghost', col: '#7ab8c0', col2: '#e8ffff',
      talk(S) {
        if (S.bosses.includes('eelmother')) return { lines: ['The lake is quiet now. Perhaps she is with her children again. Perhaps that is what quiet means.'] };
        return { lines: once(S, 'ilse') ? ['Don\'t mind the water. I drowned years ago. It was quite peaceful.', 'I studied the Mirrorlake. Its waters remember. Look into them long enough and you\'ll see Umbravale as it was: lit, and laughing.', 'The Eelmother guards the deepest pool. She lost her brood to the Gloam, and she will let no one else near the water.'] : ['The black water, the Gloomwater, burns those who cannot breathe it. The Eelmother breathes it. Perhaps she carries something that lets her.'] };
      } },
    bellkeeper: { name: 'The Bellkeeper', title: 'Ghost of the Belfry', look: 'ghost', col: '#aab9da', col2: '#ffd27a',
      talk(S) {
        if (S.bosses.includes('bellwright')) return { lines: ['The great bell is cracked. I heard it, just once. It was beautiful. I had forgotten.', 'Thank you, little flame.'] };
        return { lines: once(S, 'bk') ? ['...shhh. Shhh. The bells must not ring. If they ring, it hears.', 'The Bellwright made us silent. All of us. Every bell, every voice, every footstep...', 'Are you... are you loud, little flame? Please don\'t be loud.'] : ['Shhh...'] };
      } },
    brask: { name: 'Brask', title: 'Ashen Hermit', look: 'hermit', col: '#5f3527', col2: '#ff8c4c',
      talk(S, G) {
        if (S.bosses.includes('tyrant')) return { lines: ['So it\'s done. ...Thank you. The forge feels lighter.'] };
        if (once(S, 'brask')) { G.giveCharm('ember_trail'); return { lines: ['Bah. Another visitor. Don\'t touch the forge, it\'s still hot. It\'s been hot for three hundred years.', 'I was Vulk\'s apprentice before he became... that. He forged the Queen\'s crown. Then the Gloam crept into his fires.', 'Here, take this. It was meant for him. It leaves a trail of flame wherever you run. Try not to burn my house down.'] }; }
        return { lines: ['Still alive? Good. Vulk\'s anvil is down the chasm. Hit him hard. He\'d want that.'] };
      } },
    neme: { name: 'Neme', title: 'Last Acolyte', look: 'pilgrim', col: '#5d4b70', col2: '#ebcb7e',
      talk(S) {
        if (S.bosses.includes('oracle')) return { lines: ['She closed her eye. After a hundred years, she finally rested.', 'Her veils are yours now. Walk through what you could not walk through before.'] };
        return { lines: once(S, 'neme') ? ['Welcome, pilgrim. I am Neme, the last acolyte of the Veiled Eye.', 'The Oracle has not closed her eye in a hundred years. She watches the end, over and over, waiting for it to change.', 'Her sanctum lies beneath the nave, past the cracked floor and the drowned crypt. To reach her you must fall like stone and swim like a fish.'] : ['Fall like stone. Swim like a fish. Then you will see her.'] };
      } },
    orla: { name: 'Orla', title: 'Shade of the Handmaid', look: 'ghost', col: '#6d5d9e', col2: '#c47dff',
      talk(S) {
        return { lines: once(S, 'orla') ? ['You... you carry light. It hurts to look at. Come closer anyway.', 'I was the Queen\'s handmaid. I was there when she did it.', 'When the Gloam rose, the Queen knew it would swallow the Lantern. So she swallowed it first. She drew the whole flame into herself and sealed the Heart.', 'She thought she could hold it until the Gloam passed. But the Gloam never passes. It waits. And the flame has been burning her ever since.', 'The First Wick holds the Lantern Key. Free her, little flame. Please.'] : ['The First Wick holds the Lantern Key. Free her.'] };
      } },
  };

  LF.LORE = {
    fall: 'Here the last spark fell from the dying Lantern, and here it woke. — scratched into the stone by a careful hand',
    lantern_gate: 'THE GREAT LANTERN GATE. Sealed by order of Her Radiance, Queen Ysolde. Let none ascend until the Gloam has passed.',
    banners: 'The banners of the nine guardians hang here: Warden, Bramble, Archivist, Wyrm, Bellwright, Eelmother, Tyrant, Oracle, and the First Wick. Each swore to keep the light.',
    kings: 'Kings came and went. The Lantern did not. "We are the flame\'s guests," said the first king, "not its owners." The last king forgot this.',
    crypt: 'Here lie the Wick-Guard who burned out in service. A Wick does not die. It goes dark, and waits to be relit.',
    stair_down: 'The stair goes down farther than any map. Those who walk it come back changed, or do not come back.',
    thicket: 'The roots of Mossdeep drink from the old Lantern\'s warmth. Now that it has cooled they reach upward, searching. Mother Bramble searches with them.',
    roots_deep: 'Beneath the roots the earth turns to glass. The worms that bore through it sing as they go.',
    aurel: 'AUREL. City of the First Scribes. What is written is remembered. What is remembered endures.',
    archive: 'The Archivist ordered every book to be sealed in stone so the Gloam could not read them. Then it sealed itself, so it could not forget them.',
    vault: 'Beyond this seal lie the roads to the city of bells. Only fire may open it. — the Archivist',
    crystal: 'The crystals hold light the way a cup holds water. Break them and the light spills out, startled and bright.',
    depths: 'The crystal grows thick toward the lake. Only a great blow, shining with Lumen, can cleave it.',
    city: 'In the City of Quiet Bells, every hour was rung by a different bell. The Bellwright tuned each one by hand. When the Gloam came, he tuned them to silence.',
    bells: 'One bell for waking. One for working. One for weddings, one for weeping. One for the Queen. One — the great one — for the end.',
    aqueduct: 'The old aqueduct falls toward Cinderdeep, guarded by a hedge of iron thorns. Only something with wings might clear it.',
    lake: 'The Mirrorlake shows the past. The Gloomwater beneath shows nothing at all.',
    mirror: 'I looked into the lake and saw my mother laughing in a lit kitchen. I have not looked away since. — words carved by a trembling hand',
    forge: 'VULK\'S FORGE. Here the Queen\'s crown was made, and the nine guardians\' arms. Here the fire learned to hate.',
    tyrant: 'Vulk tried to burn the Gloam away. He fed his forge everything: coal, iron, his own name. The fire grew so hot that it forgot what it was for.',
    temple: 'TEMPLE OF THE VEILED EYE. The Oracle sees all that was, all that is, and the one thing that will be.',
    eye: 'She saw the Lantern go dark. She saw a small flame climb. She saw the Queen open her wings one last time. She would not say how it ended.',
    ossuary: 'The faithful asked to be laid where the Oracle could watch over them. She watches still.',
    gloam: 'Beneath the kingdom lies another kingdom, older and darker. The Gloam was not born here. It was waiting here.',
    first_wick: 'The First Wick went down alone. He fought the Gloam for a year and a day. On the last day, the Gloam stopped fighting and simply offered him rest.',
    cask: 'In memory of the Ninth Wick-Guard, who marched into the dark singing badly and bravely.',
    gate_inner: 'Above lies the Heart, where the Lantern once hung. What burns there now is not the Lantern, and not the Queen. It is both.',
    queen: 'Ysolde, Queen of Moths, who loved the light so much she could not bear to let it be taken. So she took it herself.',
    last: 'To whoever climbs this far: the flame must be set free, or it will burn until nothing is left. I could not do it. I am sorry. — Y.',
  };
  LF.SIGNS = {
    tut_move: 'Use [left] and [right] to move. Press [jump] to jump; hold it to jump higher. Press [interact] beside folk, benches and tablets.',
    tut_attack: 'Press [attack] to strike. Hold [up] to strike upward. In mid-air, hold [down] to strike downward; striking foes or spikes from above bounces you up.',
    tut_heal: 'Striking foes fills your Lumen vessel. Stand still and hold [heal] to focus Lumen into a mask. Resting at a bench saves your journey.',
  };
})();
