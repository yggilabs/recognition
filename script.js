(() => {
// color definitions
const COLOR_UNKNOWN = 6, 
	COLOR_NONE = 0, 
	COLOR_BLUE = 1,
	COLOR_VIOLET = 2,
	COLOR_MAGENTA = 3,
	COLOR_ORANGE = 4,
	COLOR_YELLOW = 5;

const params = new URLSearchParams(document.location.search);

const array_to_pattern = array => {
  const pattern = {
    nw: array[0],
    ne: array[1],
    sw: array[2],
    se: array[3],
  };

  return pattern;
}

const pattern_append_id = (pattern, id) => {
  pattern.id = id;

  return pattern;
}

// parse url params for pattern definitions
const base_patterns = params.get("patterns").split("").reduce((a,c) => { // monkaCodeStart
  a.c.push(parseInt(c))
  if(a.c.length == 4) {
    a.a.push(a.c)
    a.c = [];
  }
  return a;
},{a:[],c:[]}).a // monkaCodeEnd
.map(array_to_pattern).map(pattern_append_id);

// parse url for board
const base_board = params.get("board").split("").map(i => parseInt(i));
const board_width = parseInt(params.get("width")) || 10;
const board_height = parseInt(params.get("height")) || 10;
const cell_size = parseInt(params.get("size")) || 20;
const random_seed = params.get("seed") || Math.floor(99999999*Math.random());

const random = new Math.seedrandom(random_seed); // use seed param for deterministic mode or local entropy for non-deterministic mode

const root = document.querySelector(':root');

root.style.setProperty('--column-count', board_width);
root.style.setProperty('--row-count', board_height);
root.style.setProperty('--size', `${cell_size}mm`);

/*
https://yggilabs.github.io/recognition/?patterns=1523225133555211411211412322524453121154&board=6660000666660000006660002004060300000000000000100000030000200000000000600000040666050000666660000666
*/

const next_board = board => {

  const board_to_frames = board => {
    const frames = []
    
    for(let i = 0; i < board_height - 1; i++) {
      for(let j = 0; j < board_width - 1; j++) {
        // calculate positions
        const nw_index = (board_width*i)+j;
        const ne_index = nw_index + 1;
        const sw_index = nw_index + board_width;
        const se_index = sw_index + 1;
    
        const nw_value = board[nw_index];
        const ne_value = board[ne_index];
        const sw_value = board[sw_index];
        const se_value = board[se_index];
        
        // lookup values
        const frame = {
          nw: {
            value: nw_value,
            index: nw_index
          },
          ne: {
            value: ne_value,
            index: ne_index
          },
          sw: {
            value: sw_value,
            index: sw_index
          },
          se: {
            value: se_value,
            index: se_index
          }
        }

        frames.push(frame);
      }
    }

    return shuffle(frames); // removes some bias from testing
  }

  const frame_is_valid = frame => 
    (frame.nw.value >= 0 && frame.nw.value < 6) && // all values are (0, 6]
    (frame.ne.value >= 0 && frame.ne.value < 6) &&
    (frame.sw.value >= 0 && frame.sw.value < 6) &&
    (frame.se.value >= 0 && frame.se.value < 6) &&
    (frame.nw.value == 0 || frame.ne.value == 0 || frame.sw.value == 0 || frame.se.value == 0) // AND some values are 0

  const frames = board_to_frames(board).filter(frame_is_valid);

  const pattern_matches_frame = frame => {
    return pattern => 
      frame.nw.value == 0 | frame.nw.value == pattern.nw &&
      frame.ne.value == 0 | frame.ne.value == pattern.ne &&
      frame.sw.value == 0 | frame.sw.value == pattern.sw &&
      frame.se.value == 0 | frame.se.value == pattern.se

  }

  const sort_bias_desc = (a, b) => (id_counter[a.id] || 0) - (id_counter[b.id] || 0);
	const has_entropy = a => a.entropy > 0;
  const sort_entropy_asc = (a, b) => a.entropy - b.entropy;
  const calculate_entropy = frame => {
    const matches = expanded_patterns.filter(pattern_matches_frame(frame));
	frame.matches = matches;
    frame.entropy = matches.length;	
    return frame;
  };
  
  const candidates = frames.map(calculate_entropy).filter(has_entropy).sort(sort_entropy_asc);
    const selected = candidates[0];

  

  if(selected === undefined) return board; // if there are no candidates, try again
  
  // apply selected to board

  const matches = shuffle(selected.matches).sort(sort_bias_desc);
  const match = matches[0];
  
  nw_index = selected.nw.index;
  ne_index = selected.ne.index;
  sw_index = selected.sw.index;
  se_index = selected.se.index;
  
  nw_value = match.nw;
  ne_value = match.ne;
  sw_value = match.sw;
  se_value = match.se;
  
  board[nw_index] = nw_value;
  board[ne_index] = ne_value;
  board[sw_index] = sw_value;
  board[se_index] = se_value;


  id_counter[match.id] = 1 + (id_counter[match.id] || 0); // track match id

  return board;
}

// rotate a pattern "clockwise"
const rotate_pattern = pattern => {
	return {
    id: pattern.id,
		nw: pattern.sw, 
		ne: pattern.nw,
		sw: pattern.se,
		se: pattern.ne
	}
};

// recolor the nw color. assuming that nw color is COLOR_UNKNOWN
const color_pattern = (color, pattern) => {
  return {
    id: pattern.id,
    nw: color, 
    ne: pattern.ne,
    sw: pattern.sw,
    se: pattern.se
  };
};

// takes a pattern with one unknown color in nw position. return array of all possible recolors
const expand_pattern_color = pattern => {	
	return [COLOR_BLUE, COLOR_VIOLET, COLOR_MAGENTA, COLOR_ORANGE, COLOR_YELLOW].map(color => color_pattern(color, pattern))
};

// takes a pattern. return array of all possible rotations
const expand_pattern_rotate = pattern => {
	const rotations = Array(4);
	rotations[0] = pattern;
	rotations[1] = rotate_pattern(rotations[0]);
	rotations[2] = rotate_pattern(rotations[1]);
	rotations[3] = rotate_pattern(rotations[2]);
	return rotations;
};

let expanded_patterns = base_patterns.flatMap(expand_pattern_color).flatMap(expand_pattern_rotate);

const feature_patterns = base_patterns.map(pattern => color_pattern(COLOR_UNKNOWN, pattern));

const id_counter = new Array(base_patterns.length);

const shuffle = array => {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex > 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

const number_to_class = n => ["white","blue","violet","magenta","orange","yellow","black"][n];
const board_element = document.getElementById("board");
const features_element = document.getElementById("features");

const append_item = element => {
  return class_name => {
    const item = document.createElement("li");
    item.classList.add(class_name);
    element.append(item);
  };
};

let board = base_board;

// iterate through the boards
for(let i = 0; i < 200; i++) {
  expanded_patterns = shuffle(expanded_patterns);
  board = next_board(board);
}

board.map(n => n == 6 ? 0 : n).map(number_to_class).forEach(append_item(board_element));

feature_patterns.map(p => {
	const ol = document.createElement("ol");
	const li = document.createElement("li");
	ol.classList.add("feature");
	
	[p.nw, p.ne, p.sw, p.se].map(number_to_class).forEach(class_name => {
	  const item = document.createElement("li");
	  item.classList.add(class_name);
	  ol.append(item);
	});
	li.append(ol);
	features_element.append(li);
})

const color_counter = feature_patterns.reduce((a,c) => {
  a[c.ne] = (a[c.ne] || 0) + 1;
  a[c.sw] = (a[c.sw] || 0) + 1;
  a[c.se] = (a[c.se] || 0) + 1;
  return a;
},[]);  

console.log(`seed: ${random_seed}`);
console.log(`pattern_id_counts: ${id_counter}`);  
console.log(`pattern_id_count_min: ${Math.min(...id_counter)}`);
console.log(`pattern_id_count_max: ${Math.max(...id_counter)}`);
console.log(`pattern_color_counts: ${color_counter}`);

})();
